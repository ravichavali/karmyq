// Diagnostic script to test request creation from browser console
// Copy and paste this into the browser console on karmyq.com/dashboard

(async function diagnoseRequestCreation() {
  console.log('=== REQUEST CREATION DIAGNOSTIC ===\n');

  // 1. Check if axios is available
  console.log('1. Checking axios availability...');
  if (typeof axios === 'undefined') {
    console.error('❌ axios is not defined in global scope');
    console.log('   This is expected - axios is bundled in the app');
  } else {
    console.log('✅ axios is available');
  }

  // 2. Check localStorage for token
  console.log('\n2. Checking authentication token...');
  const token = localStorage.getItem('token');
  if (!token) {
    console.error('❌ No auth token found in localStorage');
    console.log('   You need to be logged in to create requests');
    return;
  }
  console.log('✅ Token found:', token.substring(0, 20) + '...');

  // 3. Check user data
  console.log('\n3. Checking user data...');
  const userStr = localStorage.getItem('user');
  if (!userStr) {
    console.error('❌ No user data in localStorage');
    return;
  }
  const user = JSON.parse(userStr);
  console.log('✅ User:', user.email, '(ID:', user.id + ')');

  // 4. Test API connectivity with GET request
  console.log('\n4. Testing GET /api/requests...');
  try {
    const getResponse = await fetch('/api/requests?limit=1', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ GET request successful:', getResponse.status);
    const getData = await getResponse.json();
    console.log('   Data:', getData);
  } catch (error) {
    console.error('❌ GET request failed:', error);
  }

  // 5. Test POST request creation
  console.log('\n5. Testing POST /api/requests...');
  const testData = {
    description: 'Test request from diagnostic script',
    title: 'Diagnostic Test',
    request_type: 'generic',
    urgency: 'medium',
    post_to_all_communities: true
  };

  console.log('   Request data:', testData);

  try {
    const postResponse = await fetch('/api/requests', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });

    console.log('✅ POST request completed with status:', postResponse.status);

    if (postResponse.ok) {
      const postData = await postResponse.json();
      console.log('✅ Request created successfully!');
      console.log('   Response:', postData);
    } else {
      const errorText = await postResponse.text();
      console.error('❌ POST request failed');
      console.error('   Status:', postResponse.status);
      console.error('   Response:', errorText);
    }
  } catch (error) {
    console.error('❌ POST request threw error:', error);
    console.error('   Error details:', error.message);
    console.error('   Stack:', error.stack);
  }

  console.log('\n=== DIAGNOSTIC COMPLETE ===');
  console.log('\nIf the fetch POST worked but the UI button doesn\'t:');
  console.log('- Check for axios interceptor issues');
  console.log('- Check for React event handler errors');
  console.log('- Check browser console for React errors');
  console.log('- Try the Network tab filtering for "requests" during button click');
})();
