# RCS Setup Guide (Google RCS Business Messaging)

To enable real RCS messaging through this API, follow these steps to configure your Google Cloud Environment.

## 1. Google Cloud Project Setup
1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a new project or select an existing one.
3.  Enable the **RCS Business Messaging API**.
4.  Go to **APIs & Services > Credentials**.
5.  Create a **Service Account**.
6.  Click on the created Service Account, go to the **Keys** tab, and click **Add Key > Create New Key**.
7.  Select **JSON** and download the file.

## 2. Integration with this API
1.  Rename the downloaded JSON file to `google-key.json`.
2.  Place `google-key.json` in the root folder of this project (`D:/Projects/NodeProject/whatsapp-api/`).
3.  Open your `.env` file and add the following:
    ```env
    RCS_AGENT_ID=your_rcs_agent_id_here
    ```

## 3. RCS Agent Creation
If you don't have an agent yet:
1.  Register as a partner on the [Google RBM Console](https://businessmessages.google.com/rbm/).
2.  Create an **Agent**.
3.  Once the agent is verified by Google, you can start sending messages to "test devices" (your phone).

## 4. Registering Test Devices
During development, you can only send RCS messages to numbers registered as test devices:
1.  In the RBM Console, select your agent.
2.  Go to **Test Devices**.
3.  Add your phone number.
4.  Open the "Messages" app on your phone and **accept** the invitation from the agent.

## 5. Handling Incoming Messages (Webhook)
To receive replies from users:
1.  Set the Webhook URL in the Google RBM Console to:
    `https://your-domain.com/api/v1/webhook/rcs`
2.  Google will send a verification token; ensure your server is publicly accessible (use `ngrok` for local testing).

---

**Note:** If `google-key.json` is missing, the API will run in **Simulated Mode**, logging the RCS payloads to the console instead of sending them to Google.
