#!/usr/bin/env node
/** Negative controls for the catalogue verifier. These are mutations of the emitted payload,
 * not assertions about decisions.json: a verifier that stopped checking the output must fail here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { build, verifyKidsDrinkSections, verifyPartnerStructures } from './map.mjs';

const payload = async () => {
  const built = await build({});
  return {
    owners: [...built.products, ...built.menus, ...built.components],
    partnerStructures: built.decisions.verification.partnerStructures,
  };
};
const byName = (owners, name) => owners.find((owner) => owner.body.name === name);

await test('explicit group-79 overrides add drinks to all three child menus', async () => {
  const { owners } = await payload();
  for (const name of ['Menu Enfant Kebab', 'Menu Enfant Hamburger', 'Menu Enfant Nuggets']) {
    const child = byName(owners, name);
    assert.equal(child.sections.filter((section) => section.__groupId === '79').length, 1);
  }
});

await test('deleting a Menu Enfant child drink section fails', async () => {
  const { owners } = await payload();
  const mutated = structuredClone(owners);
  const child = byName(mutated, 'Menu Enfant Kebab');
  child.sections = child.sections.filter((section) => section.__groupId !== '79');
  const failures = verifyKidsDrinkSections(mutated);
  assert.ok(failures.some((failure) => failure.includes('Menu Enfant Kebab')));
});

await test('duplicate or missing explicit child ownership fails', async () => {
  const { owners } = await payload();
  const duplicate = structuredClone(owners);
  duplicate.push(structuredClone(byName(duplicate, 'Menu Enfant Hamburger')));
  assert.ok(verifyKidsDrinkSections(duplicate).some((failure) => failure.includes('2 owners')));

  const missing = structuredClone(owners).filter((owner) => owner.body.name !== 'Menu Enfant Nuggets');
  assert.ok(verifyKidsDrinkSections(missing).some((failure) => failure.includes('owner is missing')));
});

await test('a duplicate child drink ref fails even when eleven refs remain', async () => {
  const { owners } = await payload();
  const mutated = structuredClone(owners);
  const child = byName(mutated, 'Menu Enfant Kebab');
  const section = child.sections.find((candidate) => candidate.__groupId === '79');
  section.itemRefs = [...section.itemRefs.slice(0, -1), section.itemRefs[0]];
  const failures = verifyKidsDrinkSections(mutated);
  assert.ok(failures.some((failure) => failure.includes('Menu Enfant Kebab')));
});

await test('an equal-cardinality non-group-79 drink substitution fails', async () => {
  const { owners } = await payload();
  const mutated = structuredClone(owners);
  const child = byName(mutated, 'Menu Enfant Kebab');
  const section = child.sections.find((candidate) => candidate.__groupId === '79');
  section.itemRefs = [...section.itemRefs.slice(0, -1), 'product:456'];
  const failures = verifyKidsDrinkSections(mutated);
  assert.ok(failures.some((failure) => failure.includes('Menu Enfant Kebab')));
});

await test('partner structure rejects a missing meat section and six choices', async () => {
  const { owners, partnerStructures } = await payload();
  assert.deepEqual(partnerStructures.products, [
    { name: 'Tacos 1 Viande', groupId: '81', count: 1, recipe: true, checkVegetables: true, checkPaidExtras: true },
    { name: 'Tacos 2 Viande', groupId: '83', count: 2, recipe: true, checkVegetables: true, checkPaidExtras: true },
    { name: 'Tacos 3 Viande', groupId: '84', count: 3, recipe: true, checkVegetables: true, checkPaidExtras: true },
    { name: 'Assiette Mixte', groupId: '84', count: 3, recipe: true, checkVegetables: true, checkPaidExtras: false },
    {
      name: 'LIBANAISE 1 VIANDE',
      groupId: '81',
      count: 1,
      recipe: false,
      checkVegetables: false,
      checkPaidExtras: false,
    },
    {
      name: 'LIBANAISE 2 VIANDE',
      groupId: '83',
      count: 2,
      recipe: false,
      checkVegetables: false,
      checkPaidExtras: false,
    },
    {
      name: 'LIBANAISE 3 VIANDE',
      groupId: '84',
      count: 3,
      recipe: false,
      checkVegetables: false,
      checkPaidExtras: false,
    },
  ]);
  assert.deepEqual(partnerStructures.meatOptions, [
    { name: 'Kebab', ref: 'component:meat:kebab' },
    { name: 'Steak', ref: 'component:meat:steak' },
    { name: 'Poulet', ref: 'component:meat:poulet' },
    { name: 'Nuggets', ref: 'component:meat:nuggets' },
    { name: 'Tenders', ref: 'component:meat:tenders' },
    { name: 'Cordon Bleu', ref: 'component:meat:cordon bleu' },
    { name: 'Falafel', ref: 'component:meat:falafel' },
  ]);
  assert.deepEqual(partnerStructures.paidExtras, { Viande: 3, Emmental: 1, Cheddar: 1, Chèvre: 1 });
  assert.deepEqual(partnerStructures.vegetables, ['Salade', 'Tomate', 'Oignon']);
  assert.deepEqual(partnerStructures.sauceRule, { min: 1, max: 2, includedFree: 2 });

  const missing = structuredClone(owners);
  const tacos = byName(missing, 'Tacos 1 Viande');
  tacos.sections = tacos.sections.filter((section) => section.__groupId !== '81');
  assert.ok(verifyPartnerStructures(missing, partnerStructures).some((failure) => failure.includes('Tacos 1 Viande')));

  const six = structuredClone(owners);
  const assiette = byName(six, 'Assiette Mixte');
  assiette.sections.find((section) => section.__groupId === '84').itemRefs = assiette.sections
    .find((section) => section.__groupId === '84')
    .itemRefs.slice(0, 6);
  assert.ok(verifyPartnerStructures(six, partnerStructures).some((failure) => failure.includes('distinct options')));
});

await test('an equal-cardinality non-meat substitution fails', async () => {
  const { owners, partnerStructures } = await payload();
  const mutated = structuredClone(owners);
  const tacos = byName(mutated, 'Tacos 1 Viande');
  const section = tacos.sections.find((candidate) => candidate.__groupId === '81');
  section.itemRefs = [...section.itemRefs.slice(0, -1), 'component:gift:fille'];
  const failures = verifyPartnerStructures(mutated, partnerStructures);
  assert.ok(failures.some((failure) => failure.includes('exact confirmed meat refs')));
});

await test('a Tacos recipe must keep its confirmed one-sauce minimum', async () => {
  const { owners, partnerStructures } = await payload();
  const mutated = structuredClone(owners);
  const recipe = mutated.find(
    (owner) => owner.body.name === 'Tacos 1 Viande' && owner.body.detailedIngredients.length > 0,
  );
  recipe.body.sauceMin = 0;
  const failures = verifyPartnerStructures(mutated, partnerStructures);
  assert.ok(failures.some((failure) => failure.includes('sauce rule must be 1..2')));
});

await test('Tacos Emmental remains an optional paid extra', async () => {
  const { owners, partnerStructures } = await payload();
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
    const failures = verifyPartnerStructures(mutated, partnerStructures);
    assert.ok(failures.some((failure) => failure.includes('optional paid extra "Emmental"')));
  }
});
