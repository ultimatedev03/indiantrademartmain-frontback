# IndianTradeMart - Advanced Version (v2.0)

## Overview
IndianTradeMart is a B2B marketplace platform built with React+Vite SPA, Node.js/Express API, and Supabase. It uses subdomain-aware routing to serve different portals: Vendor, Buyer, Admin, Directory, Employee, and Career.

## System Flow Audit (Current State)
- **Frontend Architecture**: SPAs chunked via lazy routing (`/vendor`, `/buyer`, `/admin`, etc.) with global gates (`MaintenanceGate`, `VendorSuspensionGate`). State managed via `contexts`.
- **Backend Architecture**: Express API operating mostly on `service_role` permissions with Supabase, handling Subdomain CORS, OTP generation via SMTP, Rate Limiting, and sanitization. Setup for Payments via Razorpay. DB interacts heavily through Supabase Postgres, RPCs, Auth, and Realtime.
- **Authentication**: JWT & OTP-based headless auth, integrated with Supabase Auth instances.

## Vision for Advanced Version
The goal is to elevate the platform from a standard B2B directory to an "Advanced B2B Marketplace".
Key areas of focus:
- **AI-Powered Workflows**: Automated vendor catalog tagging and buyer requirement matching.
- **Advanced Dashboarding**: Vendor analytics emphasizing conversion funnels using Recharts.
- **Real-time Collaboration**: In-platform messaging/RFQs between buyers and vendors via Supabase Realtime.
- **Enterprise Security & Scale**: RBAC (Role Based Access Control) refinements, audit logs, and optimized DB caching.
- **Global Readiness**: Localization structure and multi-currency frameworks.

## Constraints & Directives
- **Continuity (`Ralph Loop`)**: Do not drift PRD scope across context limits. This `.planning` directory serves as the eternal source of truth.
- **Stack Consistency**: Radix UI + Tailwind for UI, Express for Backend, Supabase for DB.
