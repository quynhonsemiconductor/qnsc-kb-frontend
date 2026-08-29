/**
 * Run the suite in a non-UTC timezone.
 *
 * The bug these tests cover is that the API sends naive UTC and the browser reads it as
 * local time. In a UTC runner those two readings are IDENTICAL, so every assertion about
 * them passes whether the code is right or wrong — the tests would go green on CI while
 * the defect was fully present.
 *
 * Pinning ICT, where the users are, makes the offset real (+07:00) and gives the
 * assertions something to detect. It is also what makes the "raw parse is off by the
 * local offset" test meaningful rather than vacuous.
 */
process.env.TZ = 'Asia/Ho_Chi_Minh'
