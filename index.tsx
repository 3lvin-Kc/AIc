/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {GoogleGenAI, Chat} from '@google/genai';
import { poojaSystemInstruction } from './prompts';

// DOM Elements
const chatOutput = document.getElementById('chat-output') as HTMLDivElement;
const messageInput = document.getElementById('message-input') as HTMLInputElement;
const sendButton = document.getElementById('send-button') as HTMLButtonElement;

if (!chatOutput || !messageInput || !sendButton) {
  console.error('Essential DOM elements (chatOutput, messageInput, sendButton) were not found. App cannot start.');
  document.body.innerHTML = '<p style="color:red; text-align:center; margin-top: 50px; font-family: sans-serif;">Critical Error: Chat UI elements missing. Application cannot load.</p>';
  throw new Error('Required DOM elements not found for chat application.');
}

// Helper function to display messages
function displayMessage(text: string, sender: 'user' | 'model', options?: { isPlaceholder?: boolean }): HTMLElement {
  const messageElement = document.createElement('div');
  messageElement.classList.add('message', `${sender}-message`);
  
  if (options?.isPlaceholder) { // For "Pooja is waking up..." or typing indicator
    messageElement.dataset.placeholder = 'true';
    if (text === "typing...") { // Special handling for typing indicator
        messageElement.classList.add('typing-indicator');
        const dot1 = document.createElement('span');
        const dot2 = document.createElement('span');
        const dot3 = document.createElement('span');
        messageElement.append(dot1, dot2, dot3);
    } else {
        messageElement.textContent = text;
    }
  } else {
    messageElement.textContent = text;
  }
  
  chatOutput.appendChild(messageElement);
  chatOutput.scrollTop = chatOutput.scrollHeight; // Scroll to bottom
  return messageElement;
}

let typingIndicatorElement: HTMLElement | null = null;

function displayTypingIndicator() {
  if (!typingIndicatorElement) {
    typingIndicatorElement = displayMessage("typing...", 'model', {isPlaceholder: true});
  }
}

function removeTypingIndicator() {
  if (typingIndicatorElement && chatOutput.contains(typingIndicatorElement)) {
    typingIndicatorElement.remove();
    typingIndicatorElement = null;
  }
}


// Initialize GoogleGenAI
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

(async () => {
  let chat: Chat | null = null;

  const connectingPlaceholder = displayMessage('Pooja is waking up...', 'model', {isPlaceholder: true});
  messageInput.disabled = true;
  sendButton.disabled = true;

  try {
    chat = ai.chats.create({
      model: 'gemini-2.5-flash-preview-04-17',
      config: { systemInstruction: poojaSystemInstruction }
    });

    if (connectingPlaceholder && chatOutput.contains(connectingPlaceholder)) {
      connectingPlaceholder.remove();
    }
    
    // Display Pooja's initial hardcoded greeting
    await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100)); // Short delay for initial greeting
    displayMessage("Hii", 'model');
    
    messageInput.disabled = false;
    sendButton.disabled = false;
    messageInput.focus(); 

    async function sendMessage() {
      if (!chat) {
        displayMessage("Oh great, the connection dropped. Just my luck.", 'model');
        return;
      }

      const userMessageText = messageInput.value.trim();
      if (!userMessageText) return;

      displayMessage(userMessageText, 'user');
      messageInput.value = '';
      messageInput.disabled = true;
      sendButton.disabled = true;

      displayTypingIndicator(); // Show typing indicator

      let currentModelMessageElement: HTMLElement | null = null;
      let fullModelResponse = "";
      let firstChunkReceived = false;

      try {
        const stream = await chat.sendMessageStream({ message: userMessageText });
        for await (const chunk of stream) {
          if (chunk.text) {
            if (!firstChunkReceived) {
              removeTypingIndicator(); // Remove indicator on first chunk
              firstChunkReceived = true;
            }
            fullModelResponse += chunk.text;
            if (!currentModelMessageElement) {
              currentModelMessageElement = displayMessage(fullModelResponse, 'model');
            } else {
              currentModelMessageElement.textContent = fullModelResponse;
            }
            chatOutput.scrollTop = chatOutput.scrollHeight;
          }
        }
      } catch (error) {
        console.error("Error sending message to Gemini:", error);
        removeTypingIndicator(); // Ensure indicator is removed on error
        if (currentModelMessageElement) {
            currentModelMessageElement.textContent += "\n\n...And now it's decided to act up. Wonderful.";
        } else {
            displayMessage("Hmm, that message didn't want to send. How frustrating.", 'model');
        }
      } finally {
        removeTypingIndicator(); // Ensure indicator is removed if stream ends without text
        if (!fullModelResponse && !firstChunkReceived && !document.querySelector('.typing-indicator')) {
           const existingModelMessages = chatOutput.querySelectorAll('.model-message:not([data-placeholder="true"])');
           let showError = true;
           // Avoid showing generic "..." if a specific error message was already shown for this interaction.
           if (currentModelMessageElement && currentModelMessageElement.textContent?.includes("And now it's decided to act up. Wonderful.")) {
                showError = false;
           } else if (!currentModelMessageElement && Array.from(existingModelMessages).some(el => el.textContent?.includes("Hmm, that message didn't want to send. How frustrating."))) {
                showError = false;
           }


           if (showError && !currentModelMessageElement && !document.querySelector('.model-message:not([data-placeholder="true"])')) {
             displayMessage("...", 'model'); 
           } else if (showError && !fullModelResponse && currentModelMessageElement && currentModelMessageElement.textContent === "") {
             currentModelMessageElement.textContent = "..."; 
           }
        }
        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.focus();
      }
    }

    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    });

  } catch (error) {
    console.error("Failed to initialize or connect to Gemini chat:", error);
    removeTypingIndicator(); 
    if (connectingPlaceholder && chatOutput.contains(connectingPlaceholder)) {
      connectingPlaceholder.remove();
    }
    displayMessage('Oh, for crying out loud. Is everything broken today?', 'model');
  }
})();