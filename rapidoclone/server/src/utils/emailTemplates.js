// src/utils/emailTemplates.js

/**
 * Email template functions
 */

const otpTemplate = (otp, userName = 'User') => {
  return `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>OTP Verification</h2>
          <p>Hello ${userName},</p>
          <p>Your OTP is:</p>
          <h1 style="text-align: center; color: #007bff; letter-spacing: 2px;">${otp}</h1>
          <p>This OTP is valid for 10 minutes.</p>
          <p>Do not share this OTP with anyone.</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="font-size: 12px; color: #666;">
            If you did not request this OTP, please ignore this email.
          </p>
        </div>
      </body>
    </html>
  `;
};

const welcomeTemplate = (userName = 'User', accountType = 'User') => {
  return `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Welcome to Rapido Clone!</h2>
          <p>Hello ${userName},</p>
          <p>Thank you for registering as a ${accountType} on Rapido Clone.</p>
          <p>You can now access our services and start your journey with us.</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="font-size: 12px; color: #666;">
            If you have any questions, please contact our support team.
          </p>
        </div>
      </body>
    </html>
  `;
};

const rideConfirmationTemplate = (rideDetails) => {
  return `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Ride Confirmed</h2>
          <p>Your ride has been confirmed!</p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
            <p><strong>Ride ID:</strong> ${rideDetails.rideId}</p>
            <p><strong>From:</strong> ${rideDetails.from}</p>
            <p><strong>To:</strong> ${rideDetails.to}</p>
            <p><strong>Fare:</strong> ₹${rideDetails.fare}</p>
            <p><strong>Captain:</strong> ${rideDetails.captainName}</p>
          </div>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="font-size: 12px; color: #666;">
            Thank you for using Rapido Clone!
          </p>
        </div>
      </body>
    </html>
  `;
};

const paymentReceiptTemplate = (paymentDetails) => {
  return `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Payment Receipt</h2>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
            <p><strong>Transaction ID:</strong> ${paymentDetails.transactionId}</p>
            <p><strong>Amount:</strong> ₹${paymentDetails.amount}</p>
            <p><strong>Method:</strong> ${paymentDetails.method}</p>
            <p><strong>Status:</strong> ${paymentDetails.status}</p>
            <p><strong>Date:</strong> ${paymentDetails.date}</p>
          </div>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="font-size: 12px; color: #666;">
            Keep this receipt for your records.
          </p>
        </div>
      </body>
    </html>
  `;
};

module.exports = {
  otpTemplate,
  welcomeTemplate,
  rideConfirmationTemplate,
  paymentReceiptTemplate,
};
