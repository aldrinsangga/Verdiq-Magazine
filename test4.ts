import { db } from './api/firebase.js';

async function test() {
  const snapshot = await db.collection('support_tickets').get();
  console.log(snapshot.docs.map(d => d.data()));
}

test();
