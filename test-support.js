const fetch = require('node-fetch');

async function test() {
  const res = await fetch('http://localhost:3000/api/support', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test',
      email: 'test@test.com',
      subject: 'test',
      message: 'test'
    })
  });
  console.log(res.status);
  console.log(await res.json());
}

test();
