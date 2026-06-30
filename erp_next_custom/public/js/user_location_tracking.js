(function () {
    function get_device_type() {
        const ua = navigator.userAgent || "";

        if (/tablet|ipad|playbook|silk/i.test(ua)) {
            return "Tablet";
        }

        if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) {
            return "Mobile";
        }

        return "Desktop";
    }

    function should_request_location() {
        if (!frappe.session || !frappe.session.user || frappe.session.user === "Guest") {
            return false;
        }

        // Request once per login/browser session.
        // Use sessionStorage, not localStorage, so it asks again after new login/browser session.
        const key = "erp_next_custom_exact_location_requested";

        if (sessionStorage.getItem(key)) {
            return false;
        }

        sessionStorage.setItem(key, "1");
        return true;
    }

    function send_location(args) {
        frappe.call({
            method: "erp_next_custom.api.location.log_user_exact_location",
            args: args,
            freeze: false
        });
    }

    function log_denied_or_error(status, message) {
        send_location({
            permission_status: status,
            page_url: window.location.href,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
            device_type: get_device_type(),
            accuracy: null,
            latitude: null,
            longitude: null
        });

        if (message) {
            console.log("Location tracking:", message);
        }
    }

    function request_exact_location() {
        if (!should_request_location()) {
            return;
        }

        if (!navigator.geolocation) {
            log_denied_or_error("Unavailable", "Geolocation is not supported.");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            function (position) {
                send_location({
                    permission_status: "Granted",
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    altitude: position.coords.altitude,
                    altitude_accuracy: position.coords.altitudeAccuracy,
                    heading: position.coords.heading,
                    speed: position.coords.speed,
                    page_url: window.location.href,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
                    device_type: get_device_type()
                });
            },
            function (error) {
                let status = "Error";

                if (error.code === error.PERMISSION_DENIED) {
                    status = "Denied";
                }

                if (error.code === error.POSITION_UNAVAILABLE) {
                    status = "Unavailable";
                }

                if (error.code === error.TIMEOUT) {
                    status = "Error";
                }

                log_denied_or_error(status, error.message);
            },
            {
                enableHighAccuracy: true,
                timeout: 30000,
                maximumAge: 0
            }
        );
    }

    frappe.after_ajax(function () {
        setTimeout(request_exact_location, 2000);
    });
})();