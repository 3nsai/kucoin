import crypto from "crypto";
import axios from "axios";

export class KucoinPay {
    // 🔁 Toggle between dev/prod keys
    private static readonly isProd = false;

    private static readonly privateKey = KucoinPay.isProd
        ? `-----BEGIN RSA PRIVATE KEY-----
<PROD_PRIVATE_KEY_HERE>
-----END RSA PRIVATE KEY-----`
        : `-----BEGIN RSA PRIVATE KEY-----
<DEV_PRIVATE_KEY_HERE>
-----END RSA PRIVATE KEY-----`;

    private static readonly kucoinPublicKey = KucoinPay.isProd
        ? `-----BEGIN PUBLIC KEY-----
<PROD_KUCOIN_PUBLIC_KEY_HERE>
-----END PUBLIC KEY-----`
        : `-----BEGIN PUBLIC KEY-----
<DEV_KUCOIN_PUBLIC_KEY_HERE>
-----END PUBLIC KEY-----`;

    private static readonly apiKey = KucoinPay.isProd
        ? "<PROD_API_KEY>"
        : "<DEV_API_KEY>";

    // 🧠 1. Generate signature for request
    static generateSignature(params: Record<string, any>): string {
        const sortedString = Object.entries(params)
            .filter(([_, v]) => v !== undefined && v !== "")
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join("&");

        const signer = crypto.createSign("RSA-SHA256");
        signer.update(sortedString, "utf8");
        return signer.sign(KucoinPay.privateKey, "base64");
    }

    // 🛡️ 2. Verify webhook or response
    static verifySignature(signature: string, params: Record<string, any>): boolean {
        const sortedString = Object.entries(params)
            .filter(([_, v]) => v !== undefined && v !== "")
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join("&");

        const verifier = crypto.createVerify("RSA-SHA256");
        verifier.update(sortedString, "utf8");
        return verifier.verify(KucoinPay.kucoinPublicKey, signature, "base64");
    }

    // 🛒 3. Create Order (Live API Call)
    static async createOrder(body: {
        requestId: string;
        orderAmount: number;
        orderCurrency: string;
        goods: { goodsId: string; goodsName: string; goodsDesc?: string }[];
        returnUrl: string;
        cancelUrl: string;
        source?: string;
        subMerchantId?: string;
        reference?: string;
        expireTime?: number;
    }) {
        const timestamp = Date.now();

        const payload = {
            ...body,
            apiKey: KucoinPay.apiKey,
            timestamp,
        };

        const signature = KucoinPay.generateSignature(payload);

        const headers = {
            "Content-Type": "application/json",
            "PAY-API-KEY": KucoinPay.apiKey,
            "PAY-API-SIGN": signature,
            "PAY-API-VERSION": "1.0",
            "PAY-API-TIMESTAMP": timestamp.toString(),
        };

        const url = "https://pay.kucoin.com/api/kucoinpay/api/v1/order/create";

        try {
            const res = await axios.post(url, payload, { headers });
            return res.data;
        } catch (err: any) {
            console.error("Order creation failed:", err?.response?.data || err.message);
            throw err;
        }
    }

    // 🧪 4. Test Signature Generation & Verification
    static testSignatureFlow() {
        const testParams = {
            apiKey: "kucoinpaytest",
            requestId: "test-123",
            orderAmount: 1,
            orderCurrency: "USDT",
            timestamp: Date.now(),
        };

        const signature = KucoinPay.generateSignature(testParams);
        const valid = KucoinPay.verifySignature(signature, testParams);

        console.log("Signature:", signature);
        console.log("Is valid:", valid);
        return valid;
    }
}
