"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class DocClient {
    constructor(apiUrl) {
        this.accessToken = null;
        this.refreshToken = null;
        this.apiUrl = apiUrl;
    }
    set_access_token(token) {
        this.accessToken = token;
    }
    async login(username, password, domain, fingerprint) {
        try {
            const response = await fetch(`${this.apiUrl}/api/v1/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ login: username, password, domain, fingerprint }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP ${response.status}: ${errorData.message}`);
            }
            const data = await response.json();
            this.accessToken = data.data.accessToken;
            this.refreshToken = data.data.refreshToken;
            console.log("Login successful.");
            return data.data;
        }
        catch (error) {
            console.error("Login error:", error.message);
            throw error;
        }
    }
    async refreshAccessToken() {
        try {
            if (!this.refreshToken)
                throw new Error("No refresh token available.");
            const response = await fetch(`${this.apiUrl}/api/v1/refresh`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refreshToken: this.refreshToken }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP ${response.status}: ${errorData.message}`);
            }
            const data = await response.json();
            this.accessToken = data.data.accessToken;
            this.refreshToken = data.data.refreshToken;
            console.log("Access token refreshed.");
            return true;
        }
        catch (error) {
            console.error("Token refresh error:", error.message);
            throw error;
        }
    }
    async fetchWithRetry(url, options, retry = true) {
        try {
            const response = await fetch(url, options);
            if (response.ok) {
                return await response.json();
            }
            else if (response.status === 401 && retry && this.refreshToken) {
                // console.warn("Access token expired, attempting to refresh...");
                await this.refreshAccessToken();
                options.headers = {
                    ...(options.headers || {}),
                    Authorization: `Bearer ${this.accessToken}`,
                };
                const retryResponse = await fetch(url, options);
                if (retryResponse.ok) {
                    return await retryResponse.json();
                }
                const retryErrorData = await retryResponse.json();
                throw new Error(`HTTP ${retryResponse.status}: ${retryErrorData.message}`);
            }
            const errorData = await response.json();
            // console.log(JSON.stringify(errorData, undefined, 2))
            throw new Error(`HTTP ${response.status}: ${errorData.message}`);
        }
        catch (error) {
            console.error("Request failed:", error.message);
            throw error;
        }
    }
    async request(method, command, body) {
        const url = `${this.apiUrl}${command}`;
        const options = {
            method,
            headers: {
                "Content-Type": "application/json",
                ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
        };
        // console.log(JSON.stringify(options, undefined, 2))
        return this.fetchWithRetry(url, options);
    }
    // Shortcut methods for common HTTP methods
    async get(command) {
        return this.request("GET", command);
    }
    async post(command, body) {
        return this.request("POST", command, body);
    }
    async put(command, body) {
        return this.request("PUT", command, body);
    }
    async delete(command, body) {
        return this.request("DELETE", command, body);
    }
}
exports.default = DocClient;
