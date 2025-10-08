(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-EVIDENCE-HASH u101)
(define-constant ERR-INVALID-DESCRIPTION u102)
(define-constant ERR-INVALID-LOCATION u103)
(define-constant ERR-INVALID-CATEGORY u104)
(define-constant ERR-INVALID-TAGS u105)
(define-constant ERR-REPORT-ALREADY-EXISTS u106)
(define-constant ERR-REPORT-NOT-FOUND u107)
(define-constant ERR-INVALID-TIMESTAMP u108)
(define-constant ERR-INVALID-PSEUDONYM u109)
(define-constant ERR-INVALID-ENCRYPTION-KEY u110)
(define-constant ERR-INVALID-STATUS u111)
(define-constant ERR-INVALID-SEVERITY u112)
(define-constant ERR-INVALID-WITNESSES u113)
(define-constant ERR-INVALID-ANONYMITY-LEVEL u114)
(define-constant ERR-INVALID-LANGUAGE u115)
(define-constant ERR-INVALID-URGENCY u116)
(define-constant ERR-INVALID-VERIFICATION-STATUS u117)
(define-constant ERR-MAX-REPORTS-EXCEEDED u118)
(define-constant ERR-INVALID-UPDATE-PARAM u119)
(define-constant ERR-UPDATE-NOT-ALLOWED u120)
(define-data-var next-report-id uint u0)
(define-data-var max-reports uint u10000)
(define-data-var submission-fee uint u100)
(define-data-var admin-principal principal tx-sender)
(define-map reports
  uint
  {
    evidence-hash: (buff 32),
    description: (string-utf8 500),
    location: (string-utf8 100),
    category: (string-utf8 50),
    tags: (list 10 (string-utf8 20)),
    timestamp: uint,
    reporter: principal,
    pseudonym: (optional (string-utf8 50)),
    encryption-key: (optional (buff 64)),
    status: bool,
    severity: uint,
    witnesses: uint,
    anonymity-level: uint,
    language: (string-utf8 10),
    urgency: uint,
    verification-status: uint
  }
)
(define-map reports-by-hash
  (buff 32)
  uint)
(define-map report-updates
  uint
  {
    update-description: (string-utf8 500),
    update-location: (string-utf8 100),
    update-timestamp: uint,
    updater: principal
  }
)
(define-read-only (get-report (id uint))
  (map-get? reports id)
)
(define-read-only (get-report-updates (id uint))
  (map-get? report-updates id)
)
(define-read-only (is-report-registered (hash (buff 32)))
  (is-some (map-get? reports-by-hash hash))
)
(define-private (validate-evidence-hash (hash (buff 32)))
  (if (is-eq (len hash) u32)
      (ok true)
      (err ERR-INVALID-EVIDENCE-HASH))
)
(define-private (validate-description (desc (string-utf8 500)))
  (if (and (> (len desc) u0) (<= (len desc) u500))
      (ok true)
      (err ERR-INVALID-DESCRIPTION))
)
(define-private (validate-location (loc (string-utf8 100)))
  (if (and (> (len loc) u0) (<= (len loc) u100))
      (ok true)
      (err ERR-INVALID-LOCATION))
)
(define-private (validate-category (cat (string-utf8 50)))
  (if (or (is-eq cat "torture") (is-eq cat "discrimination") (is-eq cat "freedom-of-speech") (is-eq cat "other"))
      (ok true)
      (err ERR-INVALID-CATEGORY))
)
(define-private (validate-tags (tags (list 10 (string-utf8 20))))
  (if (<= (len tags) u10)
      (ok true)
      (err ERR-INVALID-TAGS))
)
(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR-INVALID-TIMESTAMP))
)
(define-private (validate-pseudonym (pseudo (optional (string-utf8 50))))
  (match pseudo
    p (if (<= (len p) u50) (ok true) (err ERR-INVALID-PSEUDONYM))
    (ok true))
)
(define-private (validate-encryption-key (key (optional (buff 64))))
  (match key
    k (if (is-eq (len k) u64) (ok true) (err ERR-INVALID-ENCRYPTION-KEY))
    (ok true))
)
(define-private (validate-severity (sev uint))
  (if (and (>= sev u1) (<= sev u10))
      (ok true)
      (err ERR-INVALID-SEVERITY))
)
(define-private (validate-witnesses (wit uint))
  (if (<= wit u100)
      (ok true)
      (err ERR-INVALID-WITNESSES))
)
(define-private (validate-anonymity-level (anon uint))
  (if (and (>= anon u0) (<= anon u3))
      (ok true)
      (err ERR-INVALID-ANONYMITY-LEVEL))
)
(define-private (validate-language (lang (string-utf8 10)))
  (if (or (is-eq lang "en") (is-eq lang "es") (is-eq lang "fr") (is-eq lang "other"))
      (ok true)
      (err ERR-INVALID-LANGUAGE))
)
(define-private (validate-urgency (urg uint))
  (if (and (>= urg u1) (<= urg u5))
      (ok true)
      (err ERR-INVALID-URGENCY))
)
(define-private (validate-verification-status (ver uint))
  (if (and (>= ver u0) (<= ver u2))
      (ok true)
      (err ERR-INVALID-VERIFICATION-STATUS))
)
(define-public (set-max-reports (new-max uint))
  (begin
    (asserts! (is-eq tx-sender (var-get admin-principal)) (err ERR-NOT-AUTHORIZED))
    (asserts! (> new-max u0) (err ERR-INVALID-UPDATE-PARAM))
    (var-set max-reports new-max)
    (ok true)
  )
)
(define-public (set-submission-fee (new-fee uint))
  (begin
    (asserts! (is-eq tx-sender (var-get admin-principal)) (err ERR-NOT-AUTHORIZED))
    (asserts! (>= new-fee u0) (err ERR-INVALID-UPDATE-PARAM))
    (var-set submission-fee new-fee)
    (ok true)
  )
)
(define-public (submit-report
  (evidence-hash (buff 32))
  (description (string-utf8 500))
  (location (string-utf8 100))
  (category (string-utf8 50))
  (tags (list 10 (string-utf8 20)))
  (pseudonym (optional (string-utf8 50)))
  (encryption-key (optional (buff 64)))
  (severity uint)
  (witnesses uint)
  (anonymity-level uint)
  (language (string-utf8 10))
  (urgency uint)
  (verification-status uint)
)
  (let (
        (next-id (var-get next-report-id))
        (current-max (var-get max-reports))
      )
    (asserts! (< next-id current-max) (err ERR-MAX-REPORTS-EXCEEDED))
    (try! (validate-evidence-hash evidence-hash))
    (try! (validate-description description))
    (try! (validate-location location))
    (try! (validate-category category))
    (try! (validate-tags tags))
    (try! (validate-pseudonym pseudonym))
    (try! (validate-encryption-key encryption-key))
    (try! (validate-severity severity))
    (try! (validate-witnesses witnesses))
    (try! (validate-anonymity-level anonymity-level))
    (try! (validate-language language))
    (try! (validate-urgency urgency))
    (try! (validate-verification-status verification-status))
    (asserts! (is-none (map-get? reports-by-hash evidence-hash)) (err ERR-REPORT-ALREADY-EXISTS))
    (try! (stx-transfer? (var-get submission-fee) tx-sender (var-get admin-principal)))
    (map-set reports next-id
      {
        evidence-hash: evidence-hash,
        description: description,
        location: location,
        category: category,
        tags: tags,
        timestamp: block-height,
        reporter: tx-sender,
        pseudonym: pseudonym,
        encryption-key: encryption-key,
        status: true,
        severity: severity,
        witnesses: witnesses,
        anonymity-level: anonymity-level,
        language: language,
        urgency: urgency,
        verification-status: verification-status
      }
    )
    (map-set reports-by-hash evidence-hash next-id)
    (var-set next-report-id (+ next-id u1))
    (print { event: "report-submitted", id: next-id })
    (ok next-id)
  )
)
(define-public (update-report
  (report-id uint)
  (update-description (string-utf8 500))
  (update-location (string-utf8 100))
)
  (let ((report (map-get? reports report-id)))
    (match report
      r
        (begin
          (asserts! (is-eq (get reporter r) tx-sender) (err ERR-NOT-AUTHORIZED))
          (try! (validate-description update-description))
          (try! (validate-location update-location))
          (map-set reports report-id
            (merge r {
              description: update-description,
              location: update-location,
              timestamp: block-height
            })
          )
          (map-set report-updates report-id
            {
              update-description: update-description,
              update-location: update-location,
              update-timestamp: block-height,
              updater: tx-sender
            }
          )
          (print { event: "report-updated", id: report-id })
          (ok true)
        )
      (err ERR-REPORT-NOT-FOUND)
    )
  )
)
(define-public (get-report-count)
  (ok (var-get next-report-id))
)
(define-public (check-report-existence (hash (buff 32)))
  (ok (is-report-registered hash))
)