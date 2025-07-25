import crypto from "crypto";
import axios from "axios";

export class KucoinPay {
    // 🔁 Set to true for production, false for development/testing
    private static readonly isProd = false;

    // IMPORTANT: Replace these with your actual keys from the KuCoin Pay merchant portal.
    private static readonly privateKey = KucoinPay.isProd
        ? `-----BEGIN PRIVATE KEY-----
<PROD_MERCHANT_PRIVATE_KEY_HERE>
-----END PRIVATE KEY-----`
        : `-----BEGIN PRIVATE KEY-----
SAMPLE
...
-----END PRIVATE KEY-----`;

    private static readonly kucoinPublicKey = KucoinPay.isProd
        ? `-----BEGIN PUBLIC KEY-----
<PROD_KUCOIN_PUBLIC_KEY_HERE>
-----END PUBLIC KEY-----`
        : `-----BEGIN PUBLIC KEY-----
..SAMPLE.
-----END PUBLIC KEY-----`;

    private static readonly apiKey = KucoinPay.isProd
        ? "<PROD_API_KEY>"
        : "kucoinpaytest";

    private static readonly baseUrl = "https://pay.kucoin.com";

    /**
     * Generates a request signature based on a specific key order.
     * @param params - The request parameters.
     * @param keyOrder - An array defining the exact order of keys for the signature string.
     * @returns The Base64 encoded signature.
     */
    private static generateSignature(params: Record<string, any>, keyOrder: string[]): string {
        const toSignArray = keyOrder.map(key => {
            const value = params[key];
            // Filter out empty or undefined values as per documentation [cite: 115]
            if (value !== undefined && value !== null && value !== "") {
                return `${key}=${value}`;
            }
            return null;
        }).filter(item => item !== null);

        const sortedString = toSignArray.join("&");
        //logger.info("String to Sign:", sortedString);

        const signer = crypto.createSign("RSA-SHA256");
        signer.update(sortedString, "utf8");
        return signer.sign(KucoinPay.privateKey, "base64");
    }

    /**
     * Verifies an incoming webhook signature.
     * @param signature - The signature from the PAY-API-SIGN header.
     * @param body - The raw request body from the webhook.
     * @param keyOrder - An array defining the exact order of keys for verification.
     * @returns True if the signature is valid, false otherwise.
     */
    static verifySignature(signature: string, body: Record<string, any>, keyOrder: string[]): boolean {
        const toVerifyArray = keyOrder.map(key => {
            const value = body[key];
            if (value !== undefined && value !== null && value !== "") {
                return `${key}=${value}`;
            }
            return null;
        }).filter(item => item !== null);

        const stringToVerify = toVerifyArray.join("&");
        //logger.info("String to Verify:", stringToVerify);

        const verifier = crypto.createVerify("RSA-SHA256");
        verifier.update(stringToVerify, "utf8");
        return verifier.verify(KucoinPay.kucoinPublicKey, signature, "base64");
    }

    /**
     * Creates a payment order with KuCoin Pay.
     * @param body - The request body for creating an order.
     * @returns The API response from KuCoin Pay.
     */
    static async createOrder(body: {
        requestId: string;
        orderAmount: number;
        orderCurrency: string;
        goods: { goodsId: string; goodsName: string; goodsDesc?: string }[];
        returnUrl: string;
        cancelUrl: string;
        source?: "WEB" | "ANDROID" | "IOS";
        reference?: string;
        expireTime?: number;
    }) {
        const timestamp = Date.now();
        const url = `${this.baseUrl}/api/kucoinpay/api/v1/order/create`;

        const payload = {
            ...body,
            apiKey: KucoinPay.apiKey,
            timestamp,
        };

        // The key order MUST match the documentation for the Create Order API 
        const keyOrder = [
            "apiKey", "expireTime", "orderAmount", "orderCurrency", "reference",
            "requestId", "source", "subMerchantId", "timestamp"
        ];

        const signature = KucoinPay.generateSignature(payload, keyOrder);

        const headers = {
            "Content-Type": "application/json",
            "PAY-API-KEY": KucoinPay.apiKey,
            "PAY-API-SIGN": signature,
            "PAY-API-VERSION": "1.0",
            "PAY-API-TIMESTAMP": timestamp.toString(),
        };

        try {
            const res = await axios.post(url, body, { headers });
            return res.data;
        } catch (err: any) {
            //logger.error("KuCoin Pay order creation failed:", err?.response?.data || err.message);
            throw err;
        }
    }
}