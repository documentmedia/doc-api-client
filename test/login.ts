import DocClient from '../src/client';

const API_BASE_URL = `https://stage.document.no:3892`;
const FINGERPRINT = "ff78";
const DOMAIN = "somewhere";
const USER = "dummy@test.com";
const PASS = "vemmelig!32";

(async () => {
    const client = new DocClient(API_BASE_URL);

    try {
        console.log("Logging in...");
        const loginData = await client.login<any>(USER, PASS, DOMAIN, FINGERPRINT) as any;
        console.log(JSON.stringify(loginData, undefined, 2));

        console.log("Login successful:", JSON.stringify(loginData, undefined, 2));

        // Call the protected route
        console.log("Calling protected route...");

        const refreshResponse = await client.post<any>("/api/v1/refresh", { refreshToken: loginData.data.refreshToken });
        console.log("Protected Route Data (Refresh):", refreshResponse);

        // Call the unprotected route
        console.log("Calling unprotected route...");
        const logoutResponse = await client.post("/api/v1/logout", { uid: 100000 });
        console.log("Unprotected Route Data (Logout):", logoutResponse);
    } catch (error: any) {
        console.error("Error during script execution:", error.message);
    }
})();
