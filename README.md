# FairPlay: AI Dispute & Refund Mediator

FairPlay is a hackathon project that revolutionizes how e-commerce disputes are handled. By integrating Google's Gemini AI and the PayPal REST API, this application acts as an automated mediator that can listen to a customer's complaint, evaluate it against a store's return policy, and automatically issue full or partial PayPal refunds—saving merchants hours of customer service time.

## 🚀 Features
* **PayPal Checkout Integration:** Seamlessly process sandbox payments to generate authentic transaction records.
* **Conversational AI Mediator:** Uses Gemini 1.5 Flash to chat with customers and logically determine if their complaint warrants a refund based on strict policy rules.
* **Automated PayPal Refunds:** When the AI approves a refund, the Node.js backend automatically triggers the PayPal Refunds API to return the money instantly.

## 🛠️ Tools Used
* **PayPal Developer Platform:** Used for Orders API (Checkout) and Payments API (Refunds).
* **AI Tool (Google Gemini):** Used the `@google/generative-ai` SDK to process natural language complaints and output strict JSON commands to the backend.
* **Node.js & Express:** Lightweight backend to handle API routes and secure API keys.

## ⚙️ Setup Instructions for Judges

To run this project locally, follow these steps:

**1. Clone the repository and install dependencies**
```bash
git clone <YOUR_REPO_URL_HERE>
cd fairplay-app
npm install
```

**2. Configure Environment Variables**
Create a file named `.env` in the root directory and add your sandbox credentials:
```env
PAYPAL_CLIENT_ID=your_paypal_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_paypal_sandbox_secret
GEMINI_API_KEY=your_google_gemini_api_key
```

**3. Start the Server**
```bash
npm start
```

**4. Test the Application**
1. Open your browser and navigate to `http://localhost:3000`
2. **Tab 1 (Store):** Click the PayPal button to simulate a purchase. (Log in using a personal sandbox account).
3. **Tab 2 (Resolution Center):** Once the purchase succeeds, you will be moved here. Chat with the AI!
   * *Test Case 1 (Full Refund):* "The headphones arrived completely broken in half."
   * *Test Case 2 (Partial Refund):* "The headphones work, but there is a large scratch on the side."
   * *Test Case 3 (Denial):* "I just changed my mind, I don't want them anymore."

## 📄 License
This project is open-source and available under the ISC License.
