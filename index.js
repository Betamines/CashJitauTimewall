const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// 🔥 CONFIG
const FIREBASE_DB_URL = "https://cash-jitau-default-rtdb.firebaseio.com/";
const SECRET_KEY = "39f991cd4f8ebd41679bc3fba630311d";

// 🚀 POSTBACK
app.get('/postback', async (req, res) => {

    const { user_id, transaction_id, reward, revenue, hash, type } = req.query;

    // ❌ check data
    if (!user_id || !transaction_id || !reward || !hash) {
        return res.status(400).send("Missing data");
    }

    try {
        // 🔐 HASH VERIFY
        const checkString = `${user_id}${revenue}${SECRET_KEY}`;

        const validHash = crypto
            .createHash('sha256')
            .update(checkString)
            .digest('hex');

        if (hash !== validHash) {
            return res.status(403).send("Invalid hash");
        }

        // ⛔ HOLD ignore
        if (type === "hold" || type === "hold_cancelled") {
            return res.status(200).send("IGNORED");
        }

        // 🔹 USER DATA
        const userRes = await fetch(`${FIREBASE_DB_URL}/users/${user_id}.json`);
        const userData = await userRes.json();

        let coins = Number(userData?.coins || 0);

        // 💰 ADD or DEDUCT
        let amount = Number(reward);

        if (type === "chargeback") {
            amount = -Math.abs(amount);
        }

        const newCoins = coins + amount;

        // 🔹 UPDATE FIREBASE
        await fetch(`${FIREBASE_DB_URL}/users/${user_id}.json`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ coins: newCoins })
        });

        // 📜 SAVE HISTORY
        await fetch(`${FIREBASE_DB_URL}/history/${user_id}.json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount,
                transaction_id,
                type: type || "credit",
                time: Date.now()
            })
        });

        console.log("✅ SUCCESS:", user_id, amount);
        return res.status(200).send("OK");

    } catch (err) {
        console.log(err);
        return res.status(500).send("Error");
    }
});

app.listen(PORT, () => console.log("🚀 Server Running"));
