// Test API functions directly
import * as api from '../lib/api';

export async function testAPI() {
  console.log('🧪 Testing API calls...');
  
  try {
    // Test users
    console.log('Testing listUsers...');
    const users = await api.listUsers();
    console.log('Users:', users);
    
    if (users && users.length > 0) {
      const userId = users[0].id;
      console.log(`Testing listConversations for user ${userId}...`);
      
      // Test conversations
      const conversations = await api.listConversations(userId);
      console.log('Conversations:', conversations);
      
      if (conversations && conversations.length > 0) {
        const convId = conversations[0].id;
        console.log(`Testing listMessages for conversation ${convId}...`);
        
        // Test messages
        const messages = await api.listMessages(convId);
        console.log('Messages:', messages);
      }
    }
  } catch (error) {
    console.error('🧪 API Test Error:', error);
  }
}

// Call this in browser console: testAPI()