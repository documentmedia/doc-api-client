"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocApiResponse = void 0;
;
class DocApiResponse {
    constructor(success, code, message, data) {
        this.success = false;
        this.code = 500;
        this.message = "[No Message]";
        this.data = null;
        this.success = success;
        this.code = code;
        if (typeof message === "string") {
            this.message = message;
        }
        else if (message instanceof Error) {
            this.message = message.message ? `${message.message}` : "[No error message]";
        }
        else {
            this.message = "[Unknown error type]";
        }
        this.data = data;
    }
    static ok(data, message = "Success", code = 200) {
        if (!data) {
            data = {};
        }
        return new DocApiResponse(true, code, message, data);
    }
    static error(message, code = 500) {
        return new DocApiResponse(false, code, message, null);
    }
    isSuccess() {
        return this.success && this.data !== null;
    }
}
exports.DocApiResponse = DocApiResponse;
class DocClient {
    constructor(apiUrl, apiKey = null) {
        this.apiKey = null;
        this.aToken = null;
        this.rToken = null;
        this.debug = false;
        this.tokens = true;
        this.apiUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
        this.apiKey = apiKey;
    }
    set_debug(debug) {
        this.debug = debug;
    }
    disable_tokens(token) {
        this.tokens = !token;
    }
    // Overridable class methods for token storage
    get_access_token() {
        return this.aToken;
    }
    set_access_token(access) {
        this.aToken = access;
    }
    get_refresh_token() {
        return this.rToken;
    }
    set_refresh_token(refresh) {
        this.rToken = refresh;
    }
    set_apikey(apikey) {
        this.apiKey = apikey;
    }
    get_apikey() {
        return this.apiKey;
    }
    // Not overridable
    async login(username, password, domain = "", fingerprint = "") {
        try {
            const response = await fetch(`${this.apiUrl}/api/v1/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ login: username, password, domain, fingerprint }),
                credentials: 'include',
            });
            const data = await response.json();
            if (this.debug) {
                console.log('Response Headers:');
                response.headers.forEach((value, name) => {
                    console.log(`${name}: ${value}`);
                });
            }
            if (!response.ok) {
                return DocApiResponse.error(data.message || "Login Failed", response.status);
            }
            this.set_access_token(data.data.accessToken);
            this.set_refresh_token(data.data.refreshToken);
            return DocApiResponse.ok(data.data, data.message || 'Login Successfull', response.status);
        }
        catch (error) {
            return DocApiResponse.error(error.message || "[Internal Server Error]", 500);
        }
    }
    async refreshAccessToken() {
        try {
            if (!this.get_refresh_token()) {
                return DocApiResponse.error("No Refresh Token Available", 401);
            }
            const response = await fetch(`${this.apiUrl}/api/v1/refresh`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refreshToken: this.get_refresh_token() }),
                credentials: 'include',
            });
            const data = await response.json();
            if (!response.ok) {
                return DocApiResponse.error(data.message || "Token Refresh Failed", response.status);
            }
            this.set_access_token(data.data.accessToken);
            this.set_access_token(data.data.refreshToken);
            return DocApiResponse.ok(data.data, data.message || 'Token Refreshed', response.status);
        }
        catch (error) {
            return DocApiResponse.error(error.message || '[Unknown Server Error]', 500);
        }
    }
    async fetchWithRetry(url, options, retry = true) {
        try {
            const response = await fetch(url, options);
            const data = await response.json();
            if (response.ok) {
                return DocApiResponse.ok(data.data, data.message || 'Success', response.status);
            }
            if (this.apiKey) {
                return DocApiResponse.error(data.message || "Not retrying request with APIKEY set", response.status);
            }
            if (response.status === 401 && retry && this.get_refresh_token()) {
                const res = await this.refreshAccessToken();
                if (!res.success) {
                    return DocApiResponse.error(res.message, res.code);
                }
                if (this.tokens) {
                    options.headers = {
                        ...(options.headers || {}),
                        Authorization: `Bearer ${this.get_access_token()}`,
                    };
                }
                const retryResponse = await fetch(url, options);
                const retryData = await retryResponse.json();
                if (retryResponse.ok) {
                    return DocApiResponse.ok(retryData.data, retryData.message || 'Success', retryResponse.status);
                }
                return DocApiResponse.error(retryData.message || '[Retried Request Failes]', retryResponse.status);
            }
            return DocApiResponse.error(data.message || '[Unknown Request Fail]', response.status);
        }
        catch (error) {
            return DocApiResponse.error(error.message || '[Unknown Server Error]', 500);
        }
    }
    async request(method, command, body) {
        const url = `${this.apiUrl}${command}`;
        const token = this.apiKey || this.get_access_token() || null;
        const options = {
            method,
            headers: {
                "Content-Type": "application/json"
            },
            credentials: 'include',
            body: body ? JSON.stringify(body) : null,
        };
        if (this.apiKey) {
            options.headers = {
                ...(options.headers || {}),
                Authorization: `Bearer ${this.apiKey}`,
            };
        }
        else if (this.tokens) {
            options.headers = {
                ...(options.headers || {}),
                Authorization: `Bearer ${this.get_access_token()}`,
            };
        }
        return this.fetchWithRetry(url, options);
    }
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
