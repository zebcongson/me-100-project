# U-Lock Alarm (Home Screen app + push relay)

Files:
- `public/` : the web app (index.html), service worker (sw.js), manifest, icons
- `netlify/functions/alert.js` : the ESP32 calls this; it sends the push to your phone
- `netlify/functions/alerts.js` : the app reads the saved alert list from here
- `netlify/functions/arm.js` : the Disarm / Arm button. While disarmed, alerts still show in the app but no push is sent, and the receiver tells the sender to mute its buzzer
- `netlify/functions/public-key.js` : gives the app the public push key
- `netlify/functions/keys.js` : TEMPORARY, makes your push keys. Delete it after step 3.
- `package.json`, `netlify.toml` : tell Netlify how to build

## Setup
1. Make a GitHub repo and upload everything in this folder, keeping the folder structure.
2. In Netlify: Add new site, Import from Git, pick the repo. Deploy.
3. Open `https://YOUR-SITE.netlify.app/api/keys`. Copy the two keys it shows.
4. In Netlify, Site configuration, Environment variables, add:
   - `VAPID_PUBLIC` = the publicKey
   - `VAPID_PRIVATE` = the privateKey
   - `VAPID_SUBJECT` = `mailto:your-email@berkeley.edu` (must be a real mailto: or https: address)
   - `ALERT_SECRET` = a long random string only you know
5. Delete `netlify/functions/keys.js` from the repo, then redeploy.
6. On your iPhone (iOS 16.4 or later): open the site in Safari, Share, Add to Home Screen. Open it from the icon, tap Turn on notifications, Allow.
7. Copy the subscription text the app shows. In Netlify add `PUSH_SUBSCRIPTION` = that text. Redeploy.
8. In the app, open Send a test alert, enter your ALERT_SECRET, and send. Lock the phone first to test the background case.

## ESP32 (MicroPython)
```python
import urequests   # or: import requests

def send_phone_alert(text):
    try:
        r = urequests.post(
            "https://YOUR-SITE.netlify.app/api/alert",
            data=text,   # e.g. "HIGH ALERT: Strong movement detected!"
            headers={"X-Alert-Secret": "YOUR_ALERT_SECRET"},
        )
        print(r.status_code)
        r.close()
    except Exception as err:
        print("phone alert failed:", err)
```
The text can be your existing LOW/MID/HIGH alert strings; the level is read from the words.

## Notes
- Keep ALERT_SECRET, VAPID_PRIVATE and PUSH_SUBSCRIPTION out of your code, report and slides.
- Notification sound on iPhone is the default. The loud alarm tone only plays while the app is open.
- Changing an environment variable needs a new deploy before functions see it.
