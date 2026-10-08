import assert from 'node:assert/strict';

/** Keep provider object-shape checks shared while each fixture owns its expected financial proof. */
export async function assertRefundFixtureProof({ current, calls, refundResource, makeReader, verify, expected }) {
  const refund = current.providerObjects.get(refundResource).data[0];
  assert.equal(refund.object, 'refund');
  assert.equal(Object.hasOwn(refund, 'livemode'), false);

  const proof = await verify(current, makeReader(current, calls));
  assert.deepEqual(proof, expected);
  return proof;
}
