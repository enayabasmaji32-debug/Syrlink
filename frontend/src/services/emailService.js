import emailjs from "@emailjs/browser";

// Initialize EmailJS with public key
emailjs.init("EpgnqdYrlAEzFC11t");

/**
 * Send verification email via EmailJS
 * @param {string} to - Recipient email address
 * @param {string} passcode - Verification code/OTP
 * @returns {Promise<void>}
 */
export async function sendVerificationEmail(to, passcode) {
  try {
    const response = await emailjs.send(
      "service_corvet",
      "template_u2f0z7t",
      {
        to_email: to,
        passcode: passcode,
      },
      "EpgnqdYrlAEzFC11t"
    );

    if (response.status === 200) {
      console.log("✓ Verification email sent successfully to", to);
      return { ok: true, message: "Email sent successfully" };
    }
  } catch (error) {
    console.error("✗ Failed to send verification email:", error);
    throw new Error(`Email send failed: ${error.message}`);
  }
}

/**
 * Send password reset email via EmailJS
 * @param {string} to - Recipient email address
 * @param {string} resetLink - Password reset link
 * @returns {Promise<void>}
 */
export async function sendPasswordResetEmail(to, resetLink) {
  try {
    const response = await emailjs.send(
      "service_corvet",
      "template_u2f0z7t",
      {
        to_email: to,
        reset_link: resetLink,
      },
      "EpgnqdYrlAEzFC11t"
    );

    if (response.status === 200) {
      console.log("✓ Password reset email sent successfully to", to);
      return { ok: true, message: "Reset email sent successfully" };
    }
  } catch (error) {
    console.error("✗ Failed to send password reset email:", error);
    throw new Error(`Email send failed: ${error.message}`);
  }
}
