let _debug = false;
export class apiResponse {
    static parseMessage(e, def = '') {
        if (typeof e === 'string') {
            return e;
        }
        if (e instanceof Error) {
            return e.message || '[No error message]';
        }
        if (e && typeof e.message === 'string') {
            return e.message;
        }
        return def || '[Unknown error type - neither string nor has .message]';
    }
    constructor(response = {}) {
        this.success = false;
        this.code = 500;
        this.message = '[No Message]';
        this.data = null;
        this.errors = {};
        this.success = response.success ?? false;
        this.code = response.code ?? 500;
        this.message = apiResponse.parseMessage(response.message);
        this.data = response.data ?? null;
        this.errors = response.errors ?? {};
    }
    static ok(data, overrides = {}) {
        const res = new apiResponse({
            success: true,
            code: 200,
            message: 'OK',
            data,
            ...overrides,
        });
        if (_debug) {
            console.log('RESPONSE WAS OK, RES:', JSON.stringify(res, undefined, 2));
        }
        return res;
    }
    static error(message, overrides = {}) {
        return new apiResponse({
            success: false,
            code: 500,
            message,
            data: null,
            ...overrides,
        });
    }
    addError(name, value) {
        this.errors[name] = value;
    }
    isSuccess() {
        return this.success && this.data !== null;
    }
}
class apiClient {
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
        this.debug = _debug = debug;
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
    async login(username, password, domain = '', fingerprint = '') {
        try {
            const response = await fetch(`${this.apiUrl}/api/v1/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ login: username, password, domain, fingerprint }),
                credentials: 'include',
            });
            const data = await response.json();
            if (this.debug) {
                console.log('Login Response Headers:');
                response.headers.forEach((value, name) => {
                    console.log(`${name}: ${value}`);
                });
            }
            if (!response.ok) {
                return apiResponse.error('Login Failed', {
                    code: response.status,
                    ...data,
                });
            }
            this.set_access_token(data.data.accessToken);
            this.set_refresh_token(data.data.refreshToken);
            return apiResponse.ok(data.data, data);
        }
        catch (e) {
            return apiResponse.error(apiResponse.parseMessage(e, '[Unknown login response error]'));
        }
    }
    async logout(token = '') {
        try {
            const response = await fetch(`${this.apiUrl}/api/v1/logout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: token ? JSON.stringify({ token }) : '{}',
                credentials: 'include',
            });
            const data = await response.json();
            if (this.debug) {
                console.log('Logout Response Headers:');
                response.headers.forEach((value, name) => {
                    console.log(`${name}: ${value}`);
                });
            }
            if (!response.ok) {
                return apiResponse.error(data.message || 'Logout Failed', { code: response.status });
            }
            this.set_access_token(null);
            this.set_refresh_token(null);
            return apiResponse.ok(data.data, data.message || 'Logout Successfull');
        }
        catch (e) {
            return apiResponse.error(apiResponse.parseMessage(e, '[Internal Server Error]'));
        }
    }
    async refreshAccessToken() {
        try {
            if (!this.get_refresh_token()) {
                return apiResponse.error('No Refresh Token Available', { code: 401 });
            }
            const response = await fetch(`${this.apiUrl}/api/v1/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: this.get_refresh_token() }),
                credentials: 'include',
            });
            const data = await response.json();
            if (!response.ok) {
                return apiResponse.error(data.message || 'Token Refresh Failed', {
                    code: response.status,
                });
            }
            this.set_access_token(data.data.accessToken);
            this.set_access_token(data.data.refreshToken);
            return apiResponse.ok(data.data, {
                message: data.message || 'Token Refreshed',
                code: response.status,
            });
        }
        catch (e) {
            return apiResponse.error(apiResponse.parseMessage(e, '[Unknown Server Error]'));
        }
    }
    async fetchWithRetry(url, options, retry = true) {
        let response;
        try {
            response = await fetch(url, options);
        }
        catch (error) {
            return apiResponse.error(error?.message || '[Unknown Server Error]');
        }
        let data;
        try {
            data = await response.json();
        }
        catch (error) {
            return apiResponse.error(error?.message || '[Error parsing JSON]', { code: response.status });
        }
        if (response.ok) {
            return apiResponse.ok(data.data, {
                message: 'OK',
                code: response.status,
            });
        }
        if (this.apiKey) {
            return apiResponse.error(data.error || data.message || 'Not retrying request with APIKEY set', {
                code: response.status,
            });
        }
        if (response.status === 401 && retry && this.get_refresh_token()) {
            const res = await this.refreshAccessToken();
            if (!res.success) {
                return apiResponse.error(res.message, { code: res.code });
            }
            if (this.tokens) {
                options.headers = {
                    ...(options.headers || {}),
                    Authorization: `Bearer ${this.get_access_token()}`,
                };
            }
            let retry;
            try {
                retry = await fetch(url, options);
            }
            catch (error) {
                return apiResponse.error(error?.message || '[Unknown server error]');
            }
            let rdata;
            try {
                rdata = await retry.json();
            }
            catch (error) {
                return apiResponse.error(error?.message || '[Retried Request Failes]', {
                    code: retry.status,
                });
            }
            if (retry.ok) {
                return apiResponse.ok(rdata.data, {
                    message: 'OK',
                    code: response.status,
                });
            }
            else {
                return apiResponse.error(rdata.error || rdata.message || '[Unknown Request Fail]', {
                    code: response.status,
                });
            }
        }
        return apiResponse.error('[Unable to serve request]', {
            code: response.status,
        });
    }
    async request(method, command, body) {
        const url = `${this.apiUrl}${command}`;
        const token = this.apiKey || this.get_access_token() || null;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
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
        if (this.debug) {
            console.log(`Doing request: ${url} - ${JSON.stringify(options, undefined, 2)}`);
        }
        return this.fetchWithRetry(url, options);
    }
    async get(command) {
        return this.request('GET', command);
    }
    async post(command, body) {
        return this.request('POST', command, body);
    }
    async put(command, body) {
        return this.request('PUT', command, body);
    }
    async delete(command, body) {
        return this.request('DELETE', command, body);
    }
}
export default apiClient;
