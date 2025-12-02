# Default Questions for Companies Without Imports

## Overview

Companies that haven't had assessment data imported will use **standard questions** from the question bank. These are the default questions that all new companies see until they have data imported.

## Source of Default Questions

The default questions come from **`docs/question-bank.json`**, which contains the complete question bank organized by:

- **Pillars** (e.g., "BUSINESS CONCEPT & MARKET", "CUSTOMERS, SALES & BRANDING")
- **Categories** (e.g., "Value proposition", "Business model")
- **Questions** (individual statements/prompts)

## How It Works

1. **Seeding Standard Questions:**
   - Run `npm run seed:questions` to populate the database
   - This script reads `docs/question-bank.json` and creates:
     - Categories (global, shared across all companies)
     - Questions with `company_id = NULL` (standard questions)

2. **For Companies Without Imports:**
   - When a company has no imported data, the system queries:
     ```sql
     SELECT * FROM questions WHERE company_id IS NULL
     ```
   - These are the standard questions from the question bank
   - Users see these questions in the assessment form
   - Dashboard shows charts based on these questions

3. **For Companies With Imports:**
   - Once data is imported, company-specific questions are created
   - Future assessments use the company-specific questions
   - Standard questions are no longer used for that company

## Question Bank Structure

The question bank (`docs/question-bank.json`) contains ~140 questions across multiple pillars:

- **BUSINESS CONCEPT & MARKET**
  - Value proposition
  - Business model
  - Product leadership
  - Market leadership

- **CUSTOMERS, SALES & BRANDING**
  - Customer portfolio
  - Customer understanding
  - Network
  - Branding
  - Communication and marketing
  - Sales

- **ADMIN, TECH & FINANCIAL MANAGEMENT**
  - Strategy and growth planning
  - Financial management
  - Accounting
  - Financial results
  - Financing
  - Delivery management
  - Core Technology

- **ORGANIZATION & LEADERSHIP**
  - Legal
  - Ownership structure
  - Employees
  - Management
  - Board
  - Partnerships
  - Team

- **IMPACT**
  - Impact awareness
  - Impact measurement
  - Impact management
  - Impact ambitions

- **FUNDRAISING & INVESTOR RELATIONS**
  - Preparation & Documentation
  - Strategy & Targeting
  - Team & Process
  - Investor Relations

## Updating Default Questions

To update the default questions:

1. Edit `docs/question-bank.json`
2. Run `npm run seed:questions`
3. The script will upsert categories and questions
4. New companies will see the updated questions
5. Companies with existing imports are unaffected (they use their own questions)

## Notes

- Standard questions have `company_id = NULL`
- Company-specific questions have `company_id = <company_uuid>`
- The system automatically chooses the right set based on whether the company has imported data
- You can always view the current question bank in `docs/question-bank.json`


