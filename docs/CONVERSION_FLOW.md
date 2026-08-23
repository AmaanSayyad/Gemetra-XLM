# Points → XLM Conversion Flow

What happens when a user clicks **Convert to XLM** in the points modal.

---

## Current flow (MVP)

```mermaid
sequenceDiagram
    participant User
    participant Modal as PointsDisplay
    participant Hook as usePoints
    participant LS as localStorage
    participant SB as Supabase

    User->>Modal: Enter points (≥ 100)
    Modal->>Hook: convertPoints(amount)
    Hook->>Hook: Validate balance
    Hook->>Hook: xlm = points / 100
    Hook->>LS: Deduct total_points
    Hook->>SB: INSERT point_conversions
    Hook->>SB: INSERT point_transactions (converted)
    Hook-->>Modal: Success
    Modal-->>User: Show XLM equivalent
    Note over Hook,SB: On-chain XLM not sent automatically yet
```

### Steps

1. **Validate** — wallet connected, ≥ 100 points, sufficient balance
2. **Calculate** — `xlm_amount = points / 100`
3. **Deduct** — update `user_points.total_points`
4. **Record** — `point_conversions` + negative `point_transactions`
5. **UI** — badge updates immediately

---

## Production target

```mermaid
sequenceDiagram
    participant User
    participant App
    participant Edge as treasury-payout
    participant Treasury
    participant SB as Supabase

    User->>App: Convert points
    App->>SB: INSERT point_conversions (pending)
    App->>Edge: POST payout (points conversion)
    Edge->>Treasury: Sign XLM payment
    Treasury-->>Edge: tx hash
    Edge-->>App: txHash
    App->>SB: UPDATE conversion completed + tx hash
```

Options:

| Approach | Description |
|----------|-------------|
| **Edge function** | Reuse `treasury-payout` with `payoutType: 'points'` |
| **Admin batch** | Dashboard approves pending conversions daily |
| **Soroban** | On-chain redeem function (see `contracts/`) |

---

## Status

| Feature | Status |
|---------|--------|
| Points deduction | ✅ |
| Conversion records | ✅ |
| UI / history | ✅ |
| Automatic XLM transfer | ⚠️ Needs treasury wiring |

---

## Related

- [POINTS_SYSTEM.md](./POINTS_SYSTEM.md)
- [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md) — treasury secrets
