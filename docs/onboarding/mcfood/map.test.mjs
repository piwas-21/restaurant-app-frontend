#!/usr/bin/env node
/** Negative controls for the catalogue verifier. These are mutations of the emitted payload,
 * not assertions about decisions.json: a verifier that stopped checking the output must fail here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { build, verifyKidsDrinkSections, verifyPartnerStructures } from './map.mjs';

const payload = async () => {
  const built = await build({});
  return [...built.products, ...built.menus, ...built.components];
};
const byName = (owners, name) => owners.find((owner) => owner.body.name === name);

await test('explicit group-79 overrides add drinks to all three child menus', async () => {
  const owners = await payload();
  for (const name of ['Menu Enfant Kebab', 'Menu Enfant Hamburger', 'Menu Enfant Nuggets']) {
    const child = byName(owners, name);
    assert.equal(child.sections.filter((section) => section.__groupId === '79').length, 1);
  }
});

await test('deleting a Menu Enfant child drink section fails', async () => {
  const owners = await payload();
  const mutated = structuredClone(owners);
  const child = byName(mutated, 'Menu Enfant Kebab');
  child.sections = child.sections.filter((section) => section.__groupId !== '79');
  const failures = verifyKidsDrinkSections(mutated);
  assert.ok(failures.some((failure) => failure.includes('Menu Enfant Kebab')));
});

await test('duplicate or missing explicit child ownership fails', async () => {
  const owners = await payload();
  const duplicate = structuredClone(owners);
  duplicate.push(structuredClone(byName(duplicate, 'Menu Enfant Hamburger')));
  assert.ok(verifyKidsDrinkSections(duplicate).some((failure) => failure.includes('2 owners')));

  const missing = structuredClone(owners).filter((owner) => owner.body.name !== 'Menu Enfant Nuggets');
  assert.ok(verifyKidsDrinkSections(missing).some((failure) => failure.includes('owner is missing')));
});

await test('a duplicate child drink ref fails even when eleven refs remain', async () => {
  const owners = await payload();
  const mutated = structuredClone(owners);
  const child = byName(mutated, 'Menu Enfant Kebab');
  const section = child.sections.find((candidate) => candidate.__groupId === '79');
  section.itemRefs = [...section.itemRefs.slice(0, -1), section.itemRefs[0]];
  const failures = verifyKidsDrinkSections(mutated);
  assert.ok(failures.some((failure) => failure.includes('Menu Enfant Kebab')));
});

await test('an equal-cardinality non-group-79 drink substitution fails', async () => {
  const owners = await payload();
  const mutated = structuredClone(owners);
  const child = byName(mutated, 'Menu Enfant Kebab');
  const section = child.sections.find((candidate) => candidate.__groupId === '79');
  section.itemRefs = [...section.itemRefs.slice(0, -1), 'product:456'];
  const failures = verifyKidsDrinkSections(mutated);
  assert.ok(failures.some((failure) => failure.includes('Menu Enfant Kebab')));
});

await test('partner structure rejects a missing meat section and six choices', async () => {
  const owners = await payload();
  const missing = structuredClone(owners);
  const tacos = byName(missing, 'Tacos 1 Viande');
  tacos.sections = tacos.sections.filter((section) => section.__groupId !== '81');
  assert.ok(verifyPartnerStructures(missing).some((failure) => failure.includes('Tacos 1 Viande')));

  const six = structuredClone(owners);
  const assiette = byName(six, 'Assiette Mixte');
  assiette.sections.find((section) => section.__groupId === '84').itemRefs = assiette.sections
    .find((section) => section.__groupId === '84')
    .itemRefs.slice(0, 6);
  assert.ok(verifyPartnerStructures(six).some((failure) => failure.includes('seven distinct options')));
});

await test('an equal-cardinality non-meat substitution fails', async () => {
  const owners = await payload();
  const mutated = structuredClone(owners);
  const tacos = byName(mutated, 'Tacos 1 Viande');
  const section = tacos.sections.find((candidate) => candidate.__groupId === '81');
  section.itemRefs = [...section.itemRefs.slice(0, -1), 'component:gift:fille'];
  const failures = verifyPartnerStructures(mutated);
  assert.ok(failures.some((failure) => failure.includes('exact confirmed meat refs')));
});

await test('a Tacos recipe must keep its confirmed one-sauce minimum', async () => {
  const owners = await payload();
  const mutated = structuredClone(owners);
  const recipe = mutated.find(
    (owner) => owner.body.name === 'Tacos 1 Viande' && owner.body.detailedIngredients.length > 0,
  );
  recipe.body.sauceMin = 0;
  const failures = verifyPartnerStructures(mutated);
  assert.ok(failures.some((failure) => failure.includes('sauce rule must be 1..2')));
});

await test('Tacos Emmental remains an optional paid extra', async () => {
  const owners = await payload();
  for (const mutate of [
    (row) => {
      row.price = 0;
    },
    (row) => {
      row.isOptional = false;
    },
    (row) => {
      row.isIncludedInBasePrice = true;
    },
  ]) {
    const mutated = structuredClone(owners);
    const recipe = mutated.find(
      (owner) => owner.body.name === 'Tacos 1 Viande' && owner.body.detailedIngredients.length > 0,
    );
    mutate(recipe.body.detailedIngredients.find((ingredient) => ingredient.name === 'Emmental'));
    const failures = verifyPartnerStructures(mutated);
    assert.ok(failures.some((failure) => failure.includes('optional paid extra "Emmental"')));
  }
});
