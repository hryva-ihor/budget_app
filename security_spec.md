# Security Specification for Family Budget App

This document outlines the security architecture, Firestore rules constraints, and test scenarios.

## 1. Data Invariants
1. **User Profile Sanity**: A user profile document can only be written if the user is authenticated, and the document ID matches their authenticated identifier (`request.auth.uid`). Users can read their own profile, and profiles of other users in the same family.
2. **Access Isolation**: Standard database entities (`accounts`, `categories`, `transactions`, `goals`) must belong to a specific `familyId`. Reads and writes to these entities are authorized *only* if the client is authenticated and their user profile's `familyId` matches the document's `familyId`.
3. **No Temporal Drift**: Creation and modification timestamps (`createdAt`, `updatedAt`) must strictly match the server time (`request.time`).
4. **Valid Formats**: Document IDs must conform to standard path pattern formats. Transaction fields (such as `amount`) must be numeric and non-negative.

## 2. Invalidation and Abuse Payloads (The "Dirty Dozen")
To protect our system, these dirty payloads should be blocked automatically by Firestore rules:
1. **Payload 1**: Creating a transaction doc for another family ID.
2. **Payload 2**: Reading data without an authenticated session.
3. **Payload 3**: Bypassing field limits by submitting a 1MB transaction description string.
4. **Payload 4**: An authenticated user modifying a spouse's custom category fields when they do not belong to the same family.
5. **Payload 5**: Spoofing client timestamp inside transaction `createdAt` instead of using the server value.
6. **Payload 6**: Mutating `id` or `familyId` on an existing account document.
7. **Payload 7**: Bypassing validation with empty/invalid strings as custom category icon names.
8. **Payload 8**: An unverified email user editing a transaction (email verified requirement).
9. **Payload 9**: Registering an accounts file with a negative initial balance format or missing keys.
10. **Payload 10**: Directly editing another user's email or identity without permission.
11. **Payload 11**: Removing the `familyId` field or setting it to null to orphan data.
12. **Payload 12**: Bypassing savings goal integrity by setting `targetAmount` to zero or negative.

## 3. Security Test Scenarios
```typescript
// firestore.rules.test.ts (conceptual illustration)
// Real secure compilation and deployment rules follow to satisfy the red team check.
```
