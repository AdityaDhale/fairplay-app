const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const path = require('path');
const fetch = require('node-fetch'); // node-fetch@2
const { GoogleGenerativeAI } = require('@google/generative-ai');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const base = "https://api-m.sandbox.paypal.com";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- PAYPAL HELPER FUNCTIONS ---
async function generateAccessToken() {
    const auth = Buffer.from(PAYPAL_CLIENT_ID + ":" + PAYPAL_CLIENT_SECRET).toString("base64");
    const response = await fetch(`${base}/v1/oauth2/token`, {
        method: "POST",
        body: "grant_type=client_credentials",
        headers: {
            Authorization: `Basic ${auth}`,
        },
    });
    const data = await response.json();
    return data.access_token;
}

async function createOrder() {
    const accessToken = await generateAccessToken();
    const url = `${base}/v2/checkout/orders`;
    const payload = {
        intent: "CAPTURE",
        purchase_units: [
            {
                amount: { currency_code: "USD", value: "50.00" },
            },
        ],
    };
    const response = await fetch(url, {
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
        method: "POST",
        body: JSON.stringify(payload),
    });
    return response.json();
}

async function captureOrder(orderId) {
    const accessToken = await generateAccessToken();
    const url = `${base}/v2/checkout/orders/${orderId}/capture`;
    const response = await fetch(url, {
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
        method: "POST",
    });
    return response.json();
}

async function refundPayment(captureId, amount) {
    const accessToken = await generateAccessToken();
    const url = `${base}/v2/payments/captures/${captureId}/refund`;
    const payload = amount ? { amount: { value: amount, currency_code: "USD" } } : {};
    
    const response = await fetch(url, {
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
        method: "POST",
        body: JSON.stringify(payload),
    });
    return response.json();
}

// --- API ROUTES ---

app.get("/api/config", (req, res) => {
    res.json({ clientId: process.env.PAYPAL_CLIENT_ID });
});

// Create Order (for the "Store" tab)
app.post("/api/orders", async (req, res) => {
    try {
        const order = await createOrder();
        res.json(order);
    } catch (error) {
        console.error("Failed to create order:", error);
        res.status(500).json({ error: "Failed to create order." });
    }
});

// Capture Order
app.post("/api/orders/:orderID/capture", async (req, res) => {
    try {
        const { orderID } = req.params;
        const captureData = await captureOrder(orderID);
        // We will return the Capture ID to the frontend, which is needed for the refund
        const captureId = captureData.purchase_units[0].payments.captures[0].id;
        res.json({ captureId, status: captureData.status });
    } catch (error) {
        console.error("Failed to capture order:", error);
        res.status(500).json({ error: "Failed to capture order." });
    }
});

// --- AI DISPUTE ROUTE ---

// Store conversation history in memory for simplicity (In a real app, use a DB)
const chatSessions = {}; 

app.post("/api/chat", async (req, res) => {
    const { captureId, message, sessionId } = req.body;

    if (!chatSessions[sessionId]) {
        // Initialize new chat session
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        chatSessions[sessionId] = model.startChat({
            history: [
                {
                    role: "user",
                    parts: [{ text: "You are the FairPlay AI Support Agent. Your job is to handle customer complaints about a $50 pair of Premium Wireless Headphones they bought. Return Policy: 1) If the item is physically broken upon arrival, offer a full $50 refund. 2) If the item works but has cosmetic damage (scratches), offer a $15 partial refund. 3) If they just don't like the color or changed their mind, apologize but deny the refund. Always be polite. Ask clarifying questions if needed. If you decide to issue a refund (full or partial), you MUST include a JSON block exactly like this at the very end of your message: ```json {\"action\": \"refund\", \"amount\": \"15.00\"} ``` (or 50.00). Do not output this JSON until you are absolutely sure of your decision."}],
                },
                {
                    role: "model",
                    parts: [{ text: "Understood. I will act as the FairPlay AI Support Agent and follow the return policy, outputting the JSON action block only when a refund decision is finalized." }],
                }
            ],
        });
    }

    try {
        const chat = chatSessions[sessionId];
        const result = await chat.sendMessage(message);
        let aiResponse = result.response.text();
        let action = null;

        // Check if the AI decided to refund
        const jsonMatch = aiResponse.match(/```json\s*(\{.*?\})\s*```/s);
        if (jsonMatch) {
            try {
                const command = JSON.parse(jsonMatch[1]);
                if (command.action === "refund" && command.amount) {
                    action = command;
                    // Trigger PayPal Refund!
                    console.log(`AI authorized refund of $${command.amount} for capture ${captureId}`);
                    const refundResult = await refundPayment(captureId, command.amount);
                    if (refundResult.status === 'COMPLETED') {
                       aiResponse += "\n\n**[SYSTEM]: The AI has triggered a PayPal refund of $" + command.amount + ". It should appear in your sandbox account shortly!**";
                    } else {
                       aiResponse += "\n\n**[SYSTEM ERROR]: Failed to process refund.**";
                       console.error(refundResult);
                    }
                }
            } catch(e) {
                console.error("Error parsing AI JSON", e);
            }
        }

        res.json({ text: aiResponse });
    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ error: "AI failed to respond." });
    }
});


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`FairPlay Server running on http://localhost:${PORT}`);
});
