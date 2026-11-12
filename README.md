# PAYBILL

**Speak. Review. Pay.**

An AI-powered multilingual voice billing and payment app.

## 💡 The Idea

Creating bills manually takes time, especially for small shop owners. Language barriers and manual data entry make it harder.

PayBill turns spoken words into a digital invoice. Instead of typing every product name and quantity, the seller simply speaks. PayBill understands the request, prepares the bill and makes payment easier.

## 🚀 What Makes PayBill Different?

- **Voice First:** Create bills by speaking instead of typing.
- **Multilingual:** Supports Tamil, English and Hindi voice input.
- **AI Powered:** Gemini AI identifies product names and quantities from speech.
- **Seller Controlled:** The AI never creates prices. The seller reviews every item and enters the prices.
- **Smart Calculation:** The invoice total is calculated automatically.
- **Digital Payment:** PayPal Sandbox checkout for testing payments.
- **Digital Receipt:** A PAID receipt with the PayPal transaction ID.
- **Timed Download:** Receipts can be downloaded for 24 hours and 3 times, enforced on the server.
- **Person to Person:** Send an amount with a reason and get a receipt.

## ⚙️ How PayBill Works

**01 — Speak**
The seller selects a language and speaks the product details.

**02 — Understand**
AI processes the recognised speech and extracts product names and quantities.

**03 — Review**
The seller checks the extracted items and enters the correct prices.

**04 — Calculate**
PayBill calculates the total amount automatically.

**05 — Pay**
The customer completes the payment through PayPal Sandbox.

**06 — Receive**
A receipt is generated and can be downloaded within the download window.

## 🛠️ Technology Behind PayBill

| Technology | Purpose |
|---|---|
| HTML and CSS | User interface |
| JavaScript | Frontend functionality |
| Web Speech API | Voice recognition |
| Node.js and Express | Backend |
| Google Gemini API | AI bill interpretation |
| PayPal Orders API and Checkout (Sandbox) | Payment integration |
| Render | Application hosting |
| GitHub | Source code management |

## 🔐 Privacy and Security

- Card details never touch our server. PayPal handles them.
- Item names, quantities and prices are validated on the server before an order is created.
- In person-to-person mode only a masked email is stored (for example ra***@gmail.com).
- Receipt IDs are random and cannot be guessed.
- Download links are single-use tokens with server-side expiry.
- The spoken bill text is sent to the Gemini API to find the items. Please do not say names or phone numbers.
- API keys are stored as hosting environment variables and are never in the code.

## ⚠️ Limitations

- PayPal Sandbox only. No real money is used.
- Receipts are stored in memory and reset when the server restarts.
- In this demo the person paying enters the prices. In production the seller would create the bill and the customer would pay it by link.
- Speech recognition depends on the browser (Chrome works best).
- A PayPal webhook route is included but is not enabled in the demo. Payments are confirmed when the order is captured.

## 🔮 What's Next

Seller-created bills shared as a payment link, QR bill verification, PayPal webhook confirmation, bills in Tamil and English, and UPI gateway support for India.

## 🎯 Our Mission

To make digital billing simpler, faster and more accessible for small businesses by combining voice technology, AI and digital payments.

## 🌐 Live Application

https://paybill.onrender.com

The first load can take about a minute on the free hosting plan.

---

**PAYBILL — Speak. Review. Pay.**
