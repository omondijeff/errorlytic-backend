const fs = require("fs");
const path = require("path");

class PDFService {
  constructor() {
    this.templatesDir = path.join(__dirname, "../templates");
    this.ensureTemplatesDir();
  }

  ensureTemplatesDir() {
    if (!fs.existsSync(this.templatesDir)) {
      fs.mkdirSync(this.templatesDir, { recursive: true });
    }
  }

  /**
   * Generate PDF for quotation using HTML template
   * @param {Object} quotation - Quotation data
   * @param {Object} organization - Organization data
   * @param {Object} analysis - Analysis data
   * @param {Object} walkthrough - Walkthrough data
   * @returns {Promise<Buffer>} PDF buffer
   */
  async generateQuotationPDF(quotation, organization, analysis, walkthrough) {
    try {
      const html = this.generateQuotationHTML(
        quotation,
        organization,
        analysis,
        walkthrough
      );

      // For now, we'll return the HTML as a string
      // In production, you would use puppeteer or similar to convert HTML to PDF
      return {
        success: true,
        html: html,
        filename: `quotation_${quotation._id}_${Date.now()}.html`,
      };
    } catch (error) {
      console.error("PDF generation error:", error);
      throw error;
    }
  }

  /**
   * Generate HTML template for quotation
   * @param {Object} quotation - Quotation data
   * @param {Object} organization - Organization data
   * @param {Object} analysis - Analysis data
   * @param {Object} walkthrough - Walkthrough data
   * @returns {string} HTML string
   */
  generateQuotationHTML(quotation, organization, analysis, walkthrough) {
    const formatCurrency = (amount, currency) => {
      const symbols = {
        KES: "KSh",
        UGX: "USh",
        TZS: "TSh",
        USD: "$",
      };
      return `${symbols[currency] || currency} ${amount.toLocaleString()}`;
    };

    const formatDate = (date) => {
      return new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    };

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Quotation - ${organization.name}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f8f9fa;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
            text-align: center;
        }
        
        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
            font-weight: 300;
        }
        
        .header p {
            font-size: 1.1rem;
            opacity: 0.9;
        }
        
        .content {
            padding: 2rem;
        }
        
        .quotation-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 2rem;
            margin-bottom: 2rem;
            padding: 1.5rem;
            background: #f8f9fa;
            border-radius: 8px;
        }
        
        .info-section h3 {
            color: #667eea;
            margin-bottom: 1rem;
            font-size: 1.2rem;
        }
        
        .info-section p {
            margin-bottom: 0.5rem;
        }
        
        .vehicle-info {
            background: #e3f2fd;
            padding: 1.5rem;
            border-radius: 8px;
            margin-bottom: 2rem;
        }
        
        .vehicle-info h3 {
            color: #1976d2;
            margin-bottom: 1rem;
        }
        
        .diagnostic-summary {
            background: #fff3e0;
            padding: 1.5rem;
            border-radius: 8px;
            margin-bottom: 2rem;
        }
        
        .diagnostic-summary h3 {
            color: #f57c00;
            margin-bottom: 1rem;
        }
        
        .dtc-list {
            list-style: none;
        }
        
        .dtc-list li {
            background: white;
            padding: 0.8rem;
            margin: 0.5rem 0;
            border-radius: 4px;
            border-left: 4px solid #f57c00;
        }
        
        .dtc-code {
            font-weight: bold;
            color: #d84315;
        }
        
        .labor-section, .parts-section {
            margin-bottom: 2rem;
        }
        
        .section-title {
            color: #667eea;
            font-size: 1.3rem;
            margin-bottom: 1rem;
            padding-bottom: 0.5rem;
            border-bottom: 2px solid #e0e0e0;
        }
        
        .labor-table, .parts-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 1rem;
        }
        
        .labor-table th, .parts-table th {
            background: #667eea;
            color: white;
            padding: 1rem;
            text-align: left;
        }
        
        .labor-table td, .parts-table td {
            padding: 0.8rem 1rem;
            border-bottom: 1px solid #e0e0e0;
        }
        
        .labor-table tr:nth-child(even), .parts-table tr:nth-child(even) {
            background: #f8f9fa;
        }
        
        .totals-section {
            background: #f8f9fa;
            padding: 1.5rem;
            border-radius: 8px;
            margin-bottom: 2rem;
        }
        
        .totals-table {
            width: 100%;
            border-collapse: collapse;
        }
        
        .totals-table td {
            padding: 0.8rem 1rem;
            border-bottom: 1px solid #e0e0e0;
        }
        
        .totals-table .label {
            font-weight: 500;
        }
        
        .totals-table .amount {
            text-align: right;
            font-weight: bold;
        }
        
        .grand-total {
            background: #667eea;
            color: white;
            font-size: 1.2rem;
            font-weight: bold;
        }
        
        .grand-total .amount {
            color: white;
        }
        
        .notes-section {
            background: #e8f5e8;
            padding: 1.5rem;
            border-radius: 8px;
            margin-bottom: 2rem;
        }
        
        .notes-section h3 {
            color: #2e7d32;
            margin-bottom: 1rem;
        }
        
        .footer {
            background: #333;
            color: white;
            padding: 1.5rem;
            text-align: center;
        }
        
        .footer p {
            margin-bottom: 0.5rem;
        }
        
        .status-badge {
            display: inline-block;
            padding: 0.5rem 1rem;
            border-radius: 20px;
            font-size: 0.9rem;
            font-weight: bold;
            text-transform: uppercase;
        }
        
        .status-draft { background: #ffc107; color: #000; }
        .status-sent { background: #17a2b8; color: white; }
        .status-approved { background: #28a745; color: white; }
        .status-rejected { background: #dc3545; color: white; }
        
        .validity-info {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            padding: 1rem;
            border-radius: 4px;
            margin-bottom: 1rem;
        }
        
        .validity-info p {
            margin: 0;
            color: #856404;
        }
        
        @media print {
            body { background: white; }
            .container { box-shadow: none; }
            .header { background: #667eea !important; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${organization.name}</h1>
            <p>Professional Automotive Services</p>
            <p>Quotation #${quotation._id
              .toString()
              .slice(-8)
              .toUpperCase()}</p>
        </div>
        
        <div class="content">
            <div class="quotation-info">
                <div class="info-section">
                    <h3>Quotation Details</h3>
                    <p><strong>Date:</strong> ${formatDate(
                      quotation.createdAt
                    )}</p>
                    <p><strong>Status:</strong> <span class="status-badge status-${
                      quotation.status
                    }">${quotation.status}</span></p>
                    <p><strong>Currency:</strong> ${quotation.currency}</p>
                    <p><strong>Valid Until:</strong> ${formatDate(
                      quotation.validUntil
                    )}</p>
                </div>
                <div class="info-section">
                    <h3>Organization</h3>
                    <p><strong>Name:</strong> ${organization.name}</p>
                    <p><strong>Type:</strong> ${organization.type}</p>
                    <p><strong>Country:</strong> ${organization.country}</p>
                    <p><strong>Currency:</strong> ${organization.currency}</p>
                </div>
            </div>
            
            ${
              analysis.vehicleId
                ? `
            <div class="vehicle-info">
                <h3>Vehicle Information</h3>
                <p><strong>VIN:</strong> ${analysis.vehicleId.vin || "N/A"}</p>
                <p><strong>Make:</strong> ${
                  analysis.vehicleId.make || "N/A"
                }</p>
                <p><strong>Model:</strong> ${
                  analysis.vehicleId.model || "N/A"
                }</p>
                <p><strong>Year:</strong> ${
                  analysis.vehicleId.year || "N/A"
                }</p>
                <p><strong>Engine:</strong> ${
                  analysis.vehicleId.engine || "N/A"
                }</p>
            </div>
            `
                : ""
            }
            
            <div class="diagnostic-summary">
                <h3>Diagnostic Summary</h3>
                <p><strong>Analysis Date:</strong> ${formatDate(
                  analysis.createdAt
                )}</p>
                <p><strong>Severity:</strong> <span class="status-badge status-${
                  analysis.summary.severity
                }">${analysis.summary.severity}</span></p>
                <p><strong>Overview:</strong> ${analysis.summary.overview}</p>
                
                ${
                  analysis.dtcs && analysis.dtcs.length > 0
                    ? `
                <h4>Diagnostic Trouble Codes Found:</h4>
                <ul class="dtc-list">
                    ${analysis.dtcs
                      .map(
                        (dtc) => `
                    <li>
                        <span class="dtc-code">${dtc.code}</span> - ${dtc.description}
                        <br><small>Status: ${dtc.status}</small>
                    </li>
                    `
                      )
                      .join("")}
                </ul>
                `
                    : ""
                }
            </div>
            
            <div class="labor-section">
                <h3 class="section-title">Labor Charges</h3>
                <table class="labor-table">
                    <thead>
                        <tr>
                            <th>Description</th>
                            <th>Hours</th>
                            <th>Rate/Hour</th>
                            <th>Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Diagnostic & Repair Work</td>
                            <td>${quotation.labor.hours}</td>
                            <td>${formatCurrency(
                              quotation.labor.ratePerHour,
                              quotation.currency
                            )}</td>
                            <td>${formatCurrency(
                              quotation.labor.subtotal,
                              quotation.currency
                            )}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div class="parts-section">
                <h3 class="section-title">Parts & Materials</h3>
                <table class="parts-table">
                    <thead>
                        <tr>
                            <th>Part Name</th>
                            <th>Part Number</th>
                            <th>Qty</th>
                            <th>Unit Price</th>
                            <th>Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${quotation.parts
                          .map(
                            (part) => `
                        <tr>
                            <td>${part.name} ${
                              part.isOEM ? "(OEM)" : "(Aftermarket)"
                            }</td>
                            <td>${part.partNumber || "N/A"}</td>
                            <td>${part.qty}</td>
                            <td>${formatCurrency(
                              part.unitPrice,
                              quotation.currency
                            )}</td>
                            <td>${formatCurrency(
                              part.subtotal,
                              quotation.currency
                            )}</td>
                        </tr>
                        `
                          )
                          .join("")}
                    </tbody>
                </table>
            </div>
            
            <div class="totals-section">
                <h3 class="section-title">Cost Breakdown</h3>
                <table class="totals-table">
                    <tr>
                        <td class="label">Parts Subtotal:</td>
                        <td class="amount">${formatCurrency(
                          quotation.totals.parts,
                          quotation.currency
                        )}</td>
                    </tr>
                    <tr>
                        <td class="label">Labor Subtotal:</td>
                        <td class="amount">${formatCurrency(
                          quotation.totals.labor,
                          quotation.currency
                        )}</td>
                    </tr>
                    <tr>
                        <td class="label">Subtotal:</td>
                        <td class="amount">${formatCurrency(
                          quotation.totals.parts + quotation.totals.labor,
                          quotation.currency
                        )}</td>
                    </tr>
                    <tr>
                        <td class="label">Markup (${quotation.markupPct}%):</td>
                        <td class="amount">${formatCurrency(
                          (quotation.totals.parts + quotation.totals.labor) *
                            (quotation.markupPct / 100),
                          quotation.currency
                        )}</td>
                    </tr>
                    <tr>
                        <td class="label">Tax (${quotation.taxPct}%):</td>
                        <td class="amount">${formatCurrency(
                          quotation.totals.tax,
                          quotation.currency
                        )}</td>
                    </tr>
                    <tr class="grand-total">
                        <td class="label">Grand Total:</td>
                        <td class="amount">${formatCurrency(
                          quotation.totals.grand,
                          quotation.currency
                        )}</td>
                    </tr>
                </table>
            </div>
            
            ${
              quotation.notes
                ? `
            <div class="notes-section">
                <h3>Additional Notes</h3>
                <p>${quotation.notes}</p>
            </div>
            `
                : ""
            }
            
            <div class="validity-info">
                <p><strong>Important:</strong> This quotation is valid until ${formatDate(
                  quotation.validUntil
                )}. Prices are subject to change without notice.</p>
            </div>
        </div>
        
        <div class="footer">
            <p><strong>${organization.name}</strong></p>
            <p>Professional Automotive Services</p>
            <p>Generated on ${formatDate(
              new Date()
            )} by Errorlytic SaaS Platform</p>
        </div>
    </div>
</body>
</html>`;

    return html;
  }

  /**
   * Generate PDF for walkthrough using HTML template
   * @param {Object} walkthrough - Walkthrough data
   * @param {Object} analysis - Analysis data
   * @param {Object} organization - Organization data
   * @returns {Promise<Object>} PDF result
   */
  async generateWalkthroughPDF(walkthrough, analysis, organization) {
    try {
      const html = this.generateWalkthroughHTML(
        walkthrough,
        analysis,
        organization
      );

      return {
        success: true,
        html: html,
        filename: `walkthrough_${walkthrough._id}_${Date.now()}.html`,
      };
    } catch (error) {
      console.error("Walkthrough PDF generation error:", error);
      throw error;
    }
  }

  /**
   * Generate HTML template for walkthrough
   * @param {Object} walkthrough - Walkthrough data
   * @param {Object} analysis - Analysis data
   * @param {Object} organization - Organization data
   * @returns {string} HTML string
   */
  generateWalkthroughHTML(walkthrough, analysis, organization) {
    const formatTime = (minutes) => {
      if (minutes < 60) {
        return `${minutes} minutes`;
      }
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    };

    const formatDate = (date) => {
      return new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    };

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Repair Walkthrough - ${organization.name}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f8f9fa;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
        }
        
        .header {
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
            padding: 2rem;
            text-align: center;
        }
        
        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
            font-weight: 300;
        }
        
        .header p {
            font-size: 1.1rem;
            opacity: 0.9;
        }
        
        .content {
            padding: 2rem;
        }
        
        .walkthrough-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 2rem;
            margin-bottom: 2rem;
            padding: 1.5rem;
            background: #f8f9fa;
            border-radius: 8px;
        }
        
        .info-section h3 {
            color: #28a745;
            margin-bottom: 1rem;
            font-size: 1.2rem;
        }
        
        .info-section p {
            margin-bottom: 0.5rem;
        }
        
        .difficulty-badge {
            display: inline-block;
            padding: 0.5rem 1rem;
            border-radius: 20px;
            font-size: 0.9rem;
            font-weight: bold;
            text-transform: uppercase;
        }
        
        .difficulty-easy { background: #28a745; color: white; }
        .difficulty-medium { background: #ffc107; color: #000; }
        .difficulty-hard { background: #fd7e14; color: white; }
        .difficulty-expert { background: #dc3545; color: white; }
        
        .steps-section {
            margin-bottom: 2rem;
        }
        
        .section-title {
            color: #28a745;
            font-size: 1.3rem;
            margin-bottom: 1rem;
            padding-bottom: 0.5rem;
            border-bottom: 2px solid #e0e0e0;
        }
        
        .step {
            background: white;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            margin-bottom: 1rem;
            overflow: hidden;
        }
        
        .step-header {
            background: #f8f9fa;
            padding: 1rem 1.5rem;
            border-bottom: 1px solid #e0e0e0;
        }
        
        .step-number {
            display: inline-block;
            background: #28a745;
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            text-align: center;
            line-height: 30px;
            font-weight: bold;
            margin-right: 1rem;
        }
        
        .step-title {
            font-size: 1.1rem;
            font-weight: 600;
            color: #333;
        }
        
        .step-time {
            float: right;
            background: #6c757d;
            color: white;
            padding: 0.3rem 0.8rem;
            border-radius: 15px;
            font-size: 0.9rem;
        }
        
        .step-content {
            padding: 1.5rem;
        }
        
        .step-detail {
            margin-bottom: 1rem;
            color: #555;
        }
        
        .step-type {
            display: inline-block;
            padding: 0.3rem 0.8rem;
            border-radius: 15px;
            font-size: 0.8rem;
            font-weight: bold;
            text-transform: uppercase;
        }
        
        .type-check { background: #17a2b8; color: white; }
        .type-replace { background: #dc3545; color: white; }
        .type-retest { background: #28a745; color: white; }
        
        .parts-section, .tools-section {
            margin-bottom: 2rem;
        }
        
        .parts-list, .tools-list {
            list-style: none;
        }
        
        .parts-list li, .tools-list li {
            background: white;
            padding: 1rem;
            margin: 0.5rem 0;
            border-radius: 4px;
            border-left: 4px solid #28a745;
        }
        
        .part-name {
            font-weight: bold;
            color: #333;
        }
        
        .part-details {
            color: #666;
            font-size: 0.9rem;
            margin-top: 0.5rem;
        }
        
        .estimated-cost {
            color: #28a745;
            font-weight: bold;
        }
        
        .footer {
            background: #333;
            color: white;
            padding: 1.5rem;
            text-align: center;
        }
        
        .footer p {
            margin-bottom: 0.5rem;
        }
        
        @media print {
            body { background: white; }
            .container { box-shadow: none; }
            .header { background: #28a745 !important; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Repair Walkthrough</h1>
            <p>Step-by-Step Repair Guide</p>
            <p>Generated by ${organization.name}</p>
        </div>
        
        <div class="content">
            <div class="walkthrough-info">
                <div class="info-section">
                    <h3>Walkthrough Details</h3>
                    <p><strong>Generated:</strong> ${formatDate(
                      walkthrough.createdAt
                    )}</p>
                    <p><strong>Difficulty:</strong> <span class="difficulty-badge difficulty-${
                      walkthrough.difficulty
                    }">${walkthrough.difficulty}</span></p>
                    <p><strong>Total Time:</strong> ${formatTime(
                      walkthrough.totalEstimatedTime
                    )}</p>
                    <p><strong>Steps:</strong> ${walkthrough.steps.length}</p>
                </div>
                <div class="info-section">
                    <h3>Analysis Reference</h3>
                    <p><strong>Analysis ID:</strong> ${analysis._id
                      .toString()
                      .slice(-8)
                      .toUpperCase()}</p>
                    <p><strong>Severity:</strong> ${
                      analysis.summary.severity
                    }</p>
                    <p><strong>DTCs Found:</strong> ${
                      analysis.dtcs ? analysis.dtcs.length : 0
                    }</p>
                    <p><strong>Module:</strong> ${analysis.module}</p>
                </div>
            </div>
            
            <div class="steps-section">
                <h3 class="section-title">Repair Steps</h3>
                ${walkthrough.steps
                  .map(
                    (step, index) => `
                <div class="step">
                    <div class="step-header">
                        <span class="step-number">${step.order}</span>
                        <span class="step-title">${step.title}</span>
                        <span class="step-time">${formatTime(
                          step.estMinutes || 0
                        )}</span>
                    </div>
                    <div class="step-content">
                        <div class="step-detail">${step.detail}</div>
                        <span class="step-type type-${step.type}">${
                      step.type
                    }</span>
                    </div>
                </div>
                `
                  )
                  .join("")}
            </div>
            
            ${
              walkthrough.parts && walkthrough.parts.length > 0
                ? `
            <div class="parts-section">
                <h3 class="section-title">Required Parts</h3>
                <ul class="parts-list">
                    ${walkthrough.parts
                      .map(
                        (part) => `
                    <li>
                        <div class="part-name">${part.name}</div>
                        <div class="part-details">
                            <strong>Quantity:</strong> ${part.qty}<br>
                            ${
                              part.oem
                                ? `<strong>OEM:</strong> ${part.oem}<br>`
                                : ""
                            }
                            ${
                              part.alt && part.alt.length > 0
                                ? `<strong>Alternatives:</strong> ${part.alt.join(
                                    ", "
                                  )}<br>`
                                : ""
                            }
                            ${
                              part.estimatedCost
                                ? `<span class="estimated-cost">Estimated Cost: ${part.estimatedCost}</span>`
                                : ""
                            }
                        </div>
                    </li>
                    `
                      )
                      .join("")}
                </ul>
            </div>
            `
                : ""
            }
            
            ${
              walkthrough.tools && walkthrough.tools.length > 0
                ? `
            <div class="tools-section">
                <h3 class="section-title">Required Tools</h3>
                <ul class="tools-list">
                    ${walkthrough.tools
                      .map(
                        (tool) => `
                    <li>${tool}</li>
                    `
                      )
                      .join("")}
                </ul>
            </div>
            `
                : ""
            }
        </div>
        
        <div class="footer">
            <p><strong>${organization.name}</strong></p>
            <p>Professional Automotive Services</p>
            <p>Generated on ${formatDate(
              new Date()
            )} by Errorlytic SaaS Platform</p>
        </div>
    </div>
</body>
</html>`;

    return html;
  }

  /**
   * Save HTML to file (for development/testing)
   * @param {string} html - HTML content
   * @param {string} filename - Filename
   * @returns {Promise<string>} File path
   */
  async saveHTMLToFile(html, filename) {
    const filePath = path.join(this.templatesDir, filename);
    await fs.promises.writeFile(filePath, html, "utf8");
    return filePath;
  }
}

module.exports = new PDFService();
