# VAT Refund Document Format Guide

How receipts are processed in Gemetra and what to upload for best OCR results.

## Document processing sequence

```mermaid
sequenceDiagram
    participant User
    participant Form as VATRefundPage
    participant OCR as Tesseract / Gemini
    participant Math as vatClaimMath
    participant SB as Supabase

    User->>Form: Upload PDF / JPG / PNG
    Form->>OCR: Extract text (receipt, VAT, merchant)
    OCR-->>Form: Parsed fields
    User->>Form: Confirm / edit + select country
    Form->>Math: Compute XLM refund amount
    Math-->>Form: amount + country rules
    Form->>SB: Save vat_refund_details (JSONB)
```

---

## Best File Format Recommendation

### **PDF (Portable Document Format) - RECOMMENDED** ⭐
**Why PDF is Best:**
- ✅ **Structured & Professional**: Maintains document layout and formatting
- ✅ **OCR Compatible**: Can extract text using Optical Character Recognition
- ✅ **Tamper-Resistant**: Harder to modify than images
- ✅ **Universal Support**: Accepted by all government agencies
- ✅ **Multi-page Support**: Can contain multiple receipts in one file
- ✅ **Metadata Preservation**: Retains document properties and timestamps

**Recommended PDF Specifications:**
- **Format**: PDF/A (Archive format) or PDF 1.7+
- **Resolution**: Minimum 300 DPI for scanned documents
- **Text**: Searchable text (not just images)
- **Size**: Maximum 10 MB per file
- **Color**: Color or grayscale (black & white acceptable)

### **Image Formats (JPG/PNG) - ACCEPTABLE**
**When to Use:**
- ✅ Quick mobile phone photos of receipts
- ✅ Scanned receipts saved as images
- ✅ Digital receipts from email

**Image Requirements:**
- **Resolution**: Minimum 1200x1600 pixels
- **Format**: JPG (for photos) or PNG (for scanned documents)
- **Quality**: High quality, clear text, no blur
- **Size**: Maximum 5 MB per file
- **Orientation**: Correctly oriented (not rotated)

---

## Document Content Requirements

### **Required Information on Document:**

1. **Merchant/Business Details:**
   - Business name
   - VAT Registration Number
   - Business address
   - Contact information

2. **Transaction Details:**
   - Receipt/Invoice Number
   - Date of purchase
   - Total amount paid
   - VAT amount (clearly stated)
   - Currency

3. **Item Details:**
   - List of purchased items
   - Individual item prices
   - VAT breakdown (if applicable)

4. **Customer Information:**
   - Customer name (if applicable)
   - Passport number (for tourist refunds)

---

## Sample Document Structures

### Sample 1: PDF Receipt Template

```
╔══════════════════════════════════════════════════════════╗
║              THE DUBAI MALL - ROLEX BOUTIQUE            ║
║         Unit 206, The Dubai Mall                        ║
║         Financial Centre Road, Dubai, UAE                ║
║         VAT Reg: GB987654321                            ║
║         Tel: +971 4 123 4567                            ║
╠══════════════════════════════════════════════════════════╣
║ INVOICE #: DXB-2024-084729                              ║
║ DATE: 15/12/2024                                         ║
║ CUSTOMER: John Smith                                     ║
║ PASSPORT: G12345678                                      ║
╠══════════════════════════════════════════════════════════╣
║ ITEM                    QTY    PRICE      VAT      TOTAL ║
╠══════════════════════════════════════════════════════════╣
║ Rolex Submariner        1      11,875.00  625.00  12,500.00 ║
╠══════════════════════════════════════════════════════════╣
║ SUBTOTAL:                                   11,875.00 AED ║
║ VAT (5%):                                      625.00 AED ║
║ ════════════════════════════════════════════════════════ ║
║ TOTAL:                                     12,500.00 AED ║
║ ════════════════════════════════════════════════════════ ║
║                                                          ║
║ Thank you for your purchase!                            ║
║ Eligible for VAT refund at airport                      ║
╚══════════════════════════════════════════════════════════╝
```

### Sample 2: Digital Receipt (Email/App Format)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HARRODS ELECTRONICS DEPARTMENT
87-135 Brompton Road, Knightsbridge
London SW1X 7XL, United Kingdom
VAT Registration: GB234567890
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Receipt Number: LDN-2024-156892
Date: 08/11/2024
Time: 14:32:15

Items:
─────────────────────────────────────────────────────────
1x Apple MacBook Pro 16" (M3 Pro)     £2,875.00
1x Apple Magic Mouse                    £79.00
1x USB-C Hub                           £45.00
─────────────────────────────────────────────────────────
Subtotal:                              £2,999.00
VAT (20%):                             £575.00
─────────────────────────────────────────────────────────
TOTAL:                                 £3,450.00
─────────────────────────────────────────────────────────

Payment Method: Credit Card ending 4532
Transaction ID: TXN-LDN-2024-156892

This receipt is valid for VAT refund purposes.
Please present at airport customs along with passport.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Structured Data Formats

### JSON Format (For API/Programmatic Processing)

```json
{
  "documentType": "vat_receipt",
  "documentFormat": "pdf",
  "merchant": {
    "name": "The Dubai Mall - Rolex Boutique",
    "vatRegistrationNumber": "GB987654321",
    "address": {
      "street": "Unit 206, The Dubai Mall",
      "city": "Dubai",
      "country": "UAE",
      "postalCode": null
    },
    "contact": {
      "phone": "+971 4 123 4567",
      "email": "info@rolexdubai.ae"
    }
  },
  "transaction": {
    "receiptNumber": "DXB-2024-084729",
    "invoiceNumber": "INV-2024-084729",
    "date": "2024-12-15",
    "time": "15:30:00",
    "currency": "AED",
    "exchangeRate": null
  },
  "items": [
    {
      "description": "Rolex Submariner",
      "quantity": 1,
      "unitPrice": 11875.00,
      "vatRate": 5,
      "vatAmount": 625.00,
      "totalPrice": 12500.00,
      "category": "luxury_watch"
    }
  ],
  "totals": {
    "subtotal": 11875.00,
    "vatAmount": 625.00,
    "total": 12500.00,
    "currency": "AED"
  },
  "customer": {
    "name": "John Smith",
    "passportNumber": "G12345678",
    "nationality": "United Kingdom",
    "dateOfBirth": "1987-05-23",
    "flightNumber": "EK205",
    "walletAddress": "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H"
  },
  "vatRefund": {
    "eligible": true,
    "refundAmount": 625.00,
    "refundCurrency": "AED",
    "convertedAmount": 170.00,
    "convertedCurrency": "XLM",
    "exchangeRate": 3.6765
  },
  "metadata": {
    "uploadDate": "2024-12-16T10:30:00Z",
    "fileSize": 245678,
    "fileFormat": "pdf",
    "ocrConfidence": 0.95,
    "extractionMethod": "automated"
  }
}
```

### CSV Format (For Bulk Processing)

```csv
Receipt Number,Merchant Name,VAT Reg No,Merchant Address,Purchase Date,Total Amount,Currency,VAT Amount,VAT Rate,Passport Number,Nationality,Flight Number,Receiver Wallet Address,Refund Amount (XLM)
DXB-2024-084729,The Dubai Mall - Rolex Boutique,GB987654321,"Unit 206, The Dubai Mall, Financial Centre Road, Dubai, UAE",2024-12-15,12500.00,AED,625.00,5%,G12345678,United Kingdom,EK205,GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H,170.00
LDN-2024-156892,Harrods Electronics Department,GB234567890,"87-135 Brompton Road, Knightsbridge, London SW1X 7XL, United Kingdom",2024-11-08,3450.00,GBP,575.00,20%,P7654321,United States,BA286,0x8ba1f109551bD432803012645Hac136c22C19e0,156.50
PAR-2024-092341,Galeries Lafayette - Champs-Élysées,FR12345678901,"40 Boulevard Haussmann, 75009 Paris, France",2024-10-22,2800.00,EUR,466.67,20%,M9876543,Canada,AF1234,0x1234567890123456789012345678901234567890,127.00
```

---

## Document Quality Checklist

### ✅ Good Quality Document:
- [ ] Clear, readable text (no blur or smudges)
- [ ] All required information visible
- [ ] Proper orientation (not rotated)
- [ ] Good contrast (dark text on light background)
- [ ] Complete document (no cut-off edges)
- [ ] Original or high-quality scan
- [ ] File size under limit (10 MB for PDF, 5 MB for images)
- [ ] Valid file format (PDF, JPG, JPEG, or PNG)

### ❌ Poor Quality Document (Will Be Rejected):
- [ ] Blurry or out of focus
- [ ] Missing required information
- [ ] Rotated or upside down
- [ ] Low resolution (pixelated text)
- [ ] Damaged or torn
- [ ] Too dark or too light
- [ ] File format not supported
- [ ] File size too large

---

## Country-Specific Requirements

### United Arab Emirates (UAE)
- **VAT Rate**: 5%
- **Minimum Purchase**: 250 AED
- **Required Info**: VAT Registration Number, Receipt Number, Date, Amount
- **Format**: Usually in Arabic and English

### United Kingdom
- **VAT Rate**: 20%
- **Minimum Purchase**: None (but must be eligible goods)
- **Required Info**: VAT Number (GB + 9 digits), Invoice Number
- **Format**: English, clear VAT breakdown

### European Union
- **VAT Rate**: Varies by country (19-27%)
- **Minimum Purchase**: Varies by country
- **Required Info**: VAT Number (country code + digits), Invoice Number
- **Format**: Usually in local language + English

---

## Best Practices for Document Upload

1. **Use PDF when possible** - Best for structured data extraction
2. **Ensure high quality** - Clear, readable, well-lit photos/scans
3. **Include all pages** - Multi-page receipts should be combined
4. **Verify information** - Double-check all numbers before upload
5. **Keep originals** - Store physical receipts as backup
6. **Upload promptly** - Submit within 30 days of purchase
7. **Check file size** - Compress if necessary, but maintain quality

---

## Sample File Naming Convention

**Recommended Format:**
```
VAT_[Country]_[Date]_[ReceiptNumber].[ext]

Examples:
- VAT_UAE_20241215_DXB-2024-084729.pdf
- VAT_UK_20241108_LDN-2024-156892.jpg
- VAT_FR_20241022_PAR-2024-092341.png
```

---

## Technical Specifications

### PDF Requirements:
- **Version**: PDF 1.4 or higher
- **Compression**: Lossless preferred
- **Text Layer**: Searchable text (not image-only)
- **Security**: No password protection
- **Embedded Fonts**: Recommended for consistent rendering

### Image Requirements:
- **JPG**: Quality 85% or higher
- **PNG**: 24-bit color or grayscale
- **DPI**: 300 DPI minimum for scanned documents
- **Color Space**: RGB or Grayscale
- **Compression**: Lossless for PNG, high quality for JPG

---

## Data Extraction Fields

When a document is uploaded, the system should extract:

### Required Fields:
1. VAT Registration Number
2. Receipt/Invoice Number
3. Purchase Date
4. Total Amount
5. VAT Amount
6. Currency

### Optional but Recommended:
1. Merchant Name
2. Merchant Address
3. Item Details
4. Customer Name
5. Payment Method

### For Manual Verification:
1. Passport Number
2. Flight Number
3. Nationality
4. Date of Birth
5. Receiver Wallet Address

---

## Example: Complete Document Package

**File Structure:**
```
vat_refund_package/
├── receipt.pdf (Main receipt document)
├── passport_copy.pdf (Passport page copy - optional)
├── boarding_pass.pdf (Flight boarding pass - optional)
└── metadata.json (Structured data - optional)
```

**Single File Upload:**
- Upload the main receipt (PDF recommended)
- System extracts data automatically
- Manual entry available as fallback

---

## Support and Troubleshooting

### Common Issues:

1. **"File format not supported"**
   - Solution: Convert to PDF, JPG, or PNG

2. **"File too large"**
   - Solution: Compress PDF or resize image (maintain quality)

3. **"Text not readable"**
   - Solution: Re-scan or re-photograph with better lighting

4. **"Missing required information"**
   - Solution: Use manual entry to fill missing fields

5. **"OCR extraction failed"**
   - Solution: Manual entry available, or improve document quality

---

## Summary

**Best Format**: **PDF** (Portable Document Format)
- Professional, structured, OCR-friendly
- Maintains document integrity
- Universal acceptance

**Acceptable Formats**: JPG, JPEG, PNG
- Good for quick mobile uploads
- Requires high quality and resolution

**Key Requirements**:
- Clear, readable text
- All required information visible
- Proper file size and format
- Complete document (no cut-off edges)

**Data Structure**: JSON format recommended for programmatic processing
- Structured, machine-readable
- Easy to validate and process
- Supports complex nested data
