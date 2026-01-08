const nodemailer = require("nodemailer");

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
    this.brandColors = {
      primary: "#EA6A47",
      primaryDark: "#d85a37",
      dark: "#1a1a1a",
      gray: "#6b7280",
      lightGray: "#f3f4f6",
      white: "#ffffff",
    };
  }

  /**
   * Initialize the email transporter with SMTP settings
   */
  async initialize() {
    if (this.initialized) return;

    const smtpConfig = {
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    };

    // Only create transporter if SMTP credentials are configured
    if (smtpConfig.auth.user && smtpConfig.auth.pass) {
      this.transporter = nodemailer.createTransport(smtpConfig);

      // Verify connection
      try {
        await this.transporter.verify();
        console.log("Email service initialized successfully");
        this.initialized = true;
      } catch (error) {
        console.error("Email service initialization failed:", error.message);
        this.transporter = null;
      }
    } else {
      console.warn("Email service not configured - SMTP credentials missing");
    }
  }

  /**
   * Generate the email header with garage/organization branding
   */
  getEmailHeader(organizationName = "Errorlytic") {
    return `
      <div style="background: linear-gradient(135deg, ${this.brandColors.dark} 0%, #2d2d2d 100%); padding: 40px 20px; text-align: center;">
        <h1 style="color: ${this.brandColors.white}; font-size: 28px; font-weight: 700; margin: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          ${organizationName}
        </h1>
        <p style="color: ${this.brandColors.gray}; font-size: 14px; margin: 8px 0 0 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          Professional Automotive Services
        </p>
      </div>
    `;
  }

  /**
   * Generate the email footer
   */
  getEmailFooter(organizationName = "Errorlytic", organizationContact = {}) {
    const logoUrl = process.env.FRONTEND_URL
      ? `${process.env.FRONTEND_URL}/logo-web-landscape.png`
      : "https://errorlytic.tajilabs.co.ke/logo-web-landscape.png";

    const contactInfo = [];
    if (organizationContact.phone) contactInfo.push(`📞 ${organizationContact.phone}`);
    if (organizationContact.email) contactInfo.push(`✉️ ${organizationContact.email}`);

    return `
      <div style="background: ${this.brandColors.lightGray}; padding: 30px 20px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="color: ${this.brandColors.dark}; font-size: 16px; font-weight: 600; margin: 0 0 8px 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          ${organizationName}
        </p>
        ${contactInfo.length > 0 ? `
        <p style="color: ${this.brandColors.gray}; font-size: 13px; margin: 0 0 20px 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          ${contactInfo.join(' &nbsp;|&nbsp; ')}
        </p>
        ` : ''}
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="color: ${this.brandColors.gray}; font-size: 11px; margin: 0 0 8px 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
            Powered by
          </p>
          <img src="${logoUrl}" alt="Errorlytic" style="height: 24px; width: auto;" />
          <p style="color: ${this.brandColors.gray}; font-size: 10px; margin: 8px 0 0 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
            AI-Powered Automotive Diagnostics
          </p>
        </div>
      </div>
    `;
  }

  /**
   * Generate base email template
   */
  getBaseTemplate(content, organizationName, organizationContact = {}) {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${organizationName}</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
          <tr>
            <td style="padding: 20px 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <tr>
                  <td>
                    ${this.getEmailHeader(organizationName)}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 30px;">
                    ${content}
                  </td>
                </tr>
                <tr>
                  <td>
                    ${this.getEmailFooter(organizationName, organizationContact)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  /**
   * Format currency with symbol
   */
  formatCurrency(amount, currency) {
    const symbols = {
      KES: "KSh",
      UGX: "USh",
      TZS: "TSh",
      USD: "$",
    };
    return `${symbols[currency] || currency} ${amount.toLocaleString()}`;
  }

  /**
   * Generate quotation email template
   */
  generateQuotationEmailTemplate(quotation, organization, vehicle, clientName) {
    const formatDate = (date) => {
      return new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    };

    const partsHtml = quotation.parts
      .map(
        (part) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
            <strong style="color: ${this.brandColors.primary};">${part.partNumber || ""}</strong>
            ${part.name}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
            ${part.qty}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
            ${this.formatCurrency(part.subtotal, quotation.currency)}
          </td>
        </tr>
      `
      )
      .join("");

    const content = `
      <h2 style="color: ${this.brandColors.dark}; font-size: 24px; margin: 0 0 20px 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        Your Vehicle Repair Quotation
      </h2>

      <p style="color: ${this.brandColors.gray}; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        Dear ${clientName || "Valued Customer"},
      </p>

      <p style="color: ${this.brandColors.gray}; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        Thank you for choosing <strong>${organization.name}</strong>. Please find below the detailed quotation for your vehicle repair.
      </p>

      <!-- Vehicle Info Card -->
      <div style="background: ${this.brandColors.lightGray}; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
        <h3 style="color: ${this.brandColors.dark}; font-size: 16px; margin: 0 0 12px 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          Vehicle Details
        </h3>
        <p style="color: ${this.brandColors.gray}; font-size: 14px; margin: 0; line-height: 1.8; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          <strong>Make/Model:</strong> ${vehicle?.make || "N/A"} ${vehicle?.model || ""}<br>
          <strong>Year:</strong> ${vehicle?.year || "N/A"}<br>
          <strong>Registration:</strong> ${vehicle?.plate || "N/A"}
        </p>
      </div>

      <!-- Quotation Details Card -->
      <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 30px;">
        <div style="background: ${this.brandColors.primary}; padding: 15px 20px;">
          <h3 style="color: #fff; font-size: 16px; margin: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
            Quotation #${quotation._id.toString().slice(-8).toUpperCase()}
          </h3>
        </div>
        <div style="padding: 20px;">
          <p style="color: ${this.brandColors.gray}; font-size: 14px; margin: 0 0 5px 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
            <strong>Date:</strong> ${formatDate(quotation.createdAt)}
          </p>
          <p style="color: ${this.brandColors.gray}; font-size: 14px; margin: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
            <strong>Valid Until:</strong> ${formatDate(quotation.validUntil)}
          </p>
        </div>
      </div>

      <!-- Services & Parts Table -->
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 30px;">
        <thead>
          <tr style="background: ${this.brandColors.lightGray};">
            <th style="padding: 12px; text-align: left; font-size: 14px; font-weight: 600; color: ${this.brandColors.dark}; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
              Description
            </th>
            <th style="padding: 12px; text-align: center; font-size: 14px; font-weight: 600; color: ${this.brandColors.dark}; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
              Qty
            </th>
            <th style="padding: 12px; text-align: right; font-size: 14px; font-weight: 600; color: ${this.brandColors.dark}; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          ${partsHtml}
          ${
            quotation.labor.hours > 0
              ? `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
              Labor (${quotation.labor.hours} hrs @ ${this.formatCurrency(quotation.labor.ratePerHour, quotation.currency)}/hr)
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
              -
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
              ${this.formatCurrency(quotation.labor.subtotal, quotation.currency)}
            </td>
          </tr>
          `
              : ""
          }
        </tbody>
      </table>

      <!-- Totals -->
      <div style="background: ${this.brandColors.lightGray}; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td style="padding: 8px 0; font-size: 14px; color: ${this.brandColors.gray}; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
              Subtotal
            </td>
            <td style="padding: 8px 0; font-size: 14px; color: ${this.brandColors.dark}; text-align: right; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
              ${this.formatCurrency(quotation.totals.parts + quotation.totals.labor, quotation.currency)}
            </td>
          </tr>
          ${
            quotation.markupPct > 0
              ? `
          <tr>
            <td style="padding: 8px 0; font-size: 14px; color: ${this.brandColors.gray}; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
              Service Fee (${quotation.markupPct}%)
            </td>
            <td style="padding: 8px 0; font-size: 14px; color: ${this.brandColors.dark}; text-align: right; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
              ${this.formatCurrency((quotation.totals.parts + quotation.totals.labor) * (quotation.markupPct / 100), quotation.currency)}
            </td>
          </tr>
          `
              : ""
          }
          <tr>
            <td style="padding: 8px 0; font-size: 14px; color: ${this.brandColors.gray}; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
              Tax (${quotation.taxPct}%)
            </td>
            <td style="padding: 8px 0; font-size: 14px; color: ${this.brandColors.dark}; text-align: right; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
              ${this.formatCurrency(quotation.totals.tax, quotation.currency)}
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 0 0 0; font-size: 20px; font-weight: 700; color: ${this.brandColors.dark}; border-top: 2px solid #e5e7eb; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
              Grand Total
            </td>
            <td style="padding: 16px 0 0 0; font-size: 20px; font-weight: 700; color: ${this.brandColors.primary}; text-align: right; border-top: 2px solid #e5e7eb; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
              ${this.formatCurrency(quotation.totals.grand, quotation.currency)}
            </td>
          </tr>
        </table>
      </div>

      ${
        quotation.notes
          ? `
      <!-- Notes -->
      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px 20px; margin-bottom: 30px; border-radius: 0 8px 8px 0;">
        <p style="color: #92400e; font-size: 14px; margin: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          <strong>Notes:</strong> ${quotation.notes}
        </p>
      </div>
      `
          : ""
      }

      <!-- Schedule Service CTA -->
      <div style="background: linear-gradient(135deg, ${this.brandColors.primary} 0%, ${this.brandColors.primaryDark} 100%); border-radius: 12px; padding: 30px; margin: 30px 0; text-align: center;">
        <h3 style="color: #fff; font-size: 20px; margin: 0 0 12px 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          Ready to proceed?
        </h3>
        <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin: 0 0 20px 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          Schedule your service appointment online and we'll take care of the rest.
        </p>
        <a href="${process.env.FRONTEND_URL || 'https://errorlytic.tajilabs.co.ke'}/book?quotation=${quotation._id}&garage=${organization._id || ''}"
           style="display: inline-block; background: #fff; color: ${this.brandColors.primary}; text-decoration: none; padding: 14px 32px; border-radius: 50px; font-size: 16px; font-weight: 600; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          📅 Schedule Service
        </a>
      </div>

      <p style="color: ${this.brandColors.gray}; font-size: 14px; line-height: 1.6; margin: 0 0 15px 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        Have questions about this quotation? Feel free to contact us directly.
      </p>

      <p style="color: ${this.brandColors.gray}; font-size: 14px; line-height: 1.6; margin: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        Best regards,<br>
        <strong>${organization.name}</strong>
      </p>
    `;

    return this.getBaseTemplate(content, organization.name, organization.contact || {});
  }

  /**
   * Send quotation email to client
   */
  async sendQuotationEmail(quotation, organization, vehicle, clientEmail, clientName) {
    await this.initialize();

    if (!this.transporter) {
      throw new Error("Email service not configured. Please set SMTP credentials.");
    }

    if (!clientEmail) {
      throw new Error("Client email address is required");
    }

    const html = this.generateQuotationEmailTemplate(
      quotation,
      organization,
      vehicle,
      clientName
    );

    const mailOptions = {
      from: `"${organization.name}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: clientEmail,
      subject: `Vehicle Repair Quotation #${quotation._id.toString().slice(-8).toUpperCase()} - ${organization.name}`,
      html: html,
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log("Quotation email sent:", result.messageId);
      return {
        success: true,
        messageId: result.messageId,
        recipient: clientEmail,
      };
    } catch (error) {
      console.error("Failed to send quotation email:", error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Generate welcome email template
   */
  generateWelcomeEmailTemplate(userName, organizationName) {
    const content = `
      <h2 style="color: ${this.brandColors.dark}; font-size: 24px; margin: 0 0 20px 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        Welcome to Errorlytic!
      </h2>

      <p style="color: ${this.brandColors.gray}; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        Hi ${userName},
      </p>

      <p style="color: ${this.brandColors.gray}; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        Your account has been successfully created${organizationName ? ` for <strong>${organizationName}</strong>` : ""}. You can now start using our AI-powered automotive diagnostic platform.
      </p>

      <div style="background: ${this.brandColors.lightGray}; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
        <h3 style="color: ${this.brandColors.dark}; font-size: 16px; margin: 0 0 15px 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          Getting Started
        </h3>
        <ul style="color: ${this.brandColors.gray}; font-size: 14px; margin: 0; padding-left: 20px; line-height: 2; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          <li>Upload your VCDS diagnostic files</li>
          <li>Get AI-powered analysis and insights</li>
          <li>Generate professional quotations</li>
          <li>Send reports directly to your customers</li>
        </ul>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'https://errorlytic.com'}/dashboard"
           style="display: inline-block; background: ${this.brandColors.primary}; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 50px; font-size: 16px; font-weight: 600; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          Go to Dashboard
        </a>
      </div>

      <p style="color: ${this.brandColors.gray}; font-size: 14px; line-height: 1.6; margin: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        If you have any questions, feel free to reach out to our support team.
      </p>
    `;

    return this.getBaseTemplate(content, organizationName || "Errorlytic");
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(userEmail, userName, organizationName) {
    await this.initialize();

    if (!this.transporter) {
      console.warn("Email service not configured, skipping welcome email");
      return { success: false, reason: "Email service not configured" };
    }

    const html = this.generateWelcomeEmailTemplate(userName, organizationName);

    const mailOptions = {
      from: `"Errorlytic" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: userEmail,
      subject: "Welcome to Errorlytic - AI-Powered Automotive Diagnostics",
      html: html,
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log("Welcome email sent:", result.messageId);
      return {
        success: true,
        messageId: result.messageId,
        recipient: userEmail,
      };
    } catch (error) {
      console.error("Failed to send welcome email:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send generic email
   */
  async sendEmail(to, subject, html, from = null) {
    await this.initialize();

    if (!this.transporter) {
      throw new Error("Email service not configured");
    }

    const mailOptions = {
      from: from || `"Errorlytic" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    };

    const result = await this.transporter.sendMail(mailOptions);
    return {
      success: true,
      messageId: result.messageId,
    };
  }
}

module.exports = new EmailService();
