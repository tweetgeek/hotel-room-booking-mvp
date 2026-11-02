// Every Polish text of the UI lives here; the API returns codes only (ADR-009).

export type ReservationStatus = 'PendingPayment' | 'Confirmed' | 'Rejected' | 'Expired' | 'Cancelled';
export type RejectionReason = 'rejected_by_operator' | 'abandoned_by_guest';
export type EventType =
  | 'ReservationRequested'
  | 'PaymentConfirmed'
  | 'PaymentRejected'
  | 'ReservationExpired'
  | 'ReservationCancelled';

const errors: Record<string, string> = {
  NOT_FOUND: 'Nie znaleziono rezerwacji.',
  VALIDATION_FAILED: 'Sprawdź wpisane dane.',
  INVALID_STAY: 'Wybrany termin jest nieprawidłowy.',
  ROOM_NOT_AVAILABLE: 'Wybrane noce są już zajęte.',
  INVALID_SECURE_CODE: 'Błędny kod bezpieczeństwa.',
  TOO_MANY_ATTEMPTS: 'Za dużo nieudanych prób. Spróbuj ponownie później.',
  UNAUTHORIZED: 'Dostęp wygasł. Wpisz kod bezpieczeństwa ponownie.',
  RESERVATION_NOT_CANCELLABLE: 'Nie udało się anulować rezerwacji: nie można jej już anulować.',
  RESERVATION_NOT_PENDING: 'Rezerwacja wygasła, płatność nie została przyjęta.',
  CONCURRENCY_CONFLICT: 'Rezerwacja zmieniła się w międzyczasie. Spróbuj ponownie.',
  INVALID_SIGNATURE: 'Nieprawidłowy podpis.',
  NETWORK_ERROR: 'Brak połączenia z serwerem. Sprawdź sieć i spróbuj ponownie.',
  UNKNOWN_ERROR: 'Coś poszło nie tak. Spróbuj ponownie.',
};

const fields: Record<string, Record<string, string>> = {
  guestName: {
    REQUIRED: 'Podaj imię i nazwisko.',
    TOO_LONG: 'Imię i nazwisko może mieć najwyżej 100 znaków.',
  },
  guestEmail: {
    REQUIRED: 'Podaj adres e-mail.',
    INVALID_EMAIL: 'Podaj poprawny adres e-mail.',
  },
  checkIn: {
    REQUIRED: 'Wybierz dzień przyjazdu.',
    INVALID_DATE: 'Nieprawidłowa data przyjazdu.',
    CHECK_IN_IN_PAST: 'Dzień przyjazdu nie może być wcześniejszy niż dziś.',
  },
  checkOut: {
    REQUIRED: 'Wybierz dzień wyjazdu.',
    INVALID_DATE: 'Nieprawidłowa data wyjazdu.',
    CHECK_OUT_NOT_AFTER_CHECK_IN: 'Dzień wyjazdu musi być późniejszy niż dzień przyjazdu.',
    TOO_MANY_NIGHTS: 'Pobyt może trwać najwyżej 30 nocy.',
  },
  secureCode: {
    REQUIRED: 'Wpisz kod bezpieczeństwa.',
    INVALID_FORMAT: 'Kod ma 6 znaków: litery i cyfry.',
  },
};

const status: Record<ReservationStatus, string> = {
  PendingPayment: 'Oczekuje na płatność',
  Confirmed: 'Potwierdzona',
  Rejected: 'Płatność odrzucona',
  Expired: 'Wygasła',
  Cancelled: 'Anulowana',
};

const timeline: Record<EventType, string> = {
  ReservationRequested: 'Rezerwacja utworzona',
  PaymentConfirmed: 'Płatność potwierdzona',
  PaymentRejected: 'Płatność odrzucona',
  ReservationExpired: 'Rezerwacja wygasła',
  ReservationCancelled: 'Anulowana przez gościa',
};

const features: Record<string, string> = {
  balcony: 'Balkon',
  wifi: 'Wi-Fi',
  tv: 'Telewizor',
  crib: 'Łóżeczko dla niemowlęcia',
  kettle: 'Czajnik',
  terrace: 'Taras',
  kitchenette: 'Aneks kuchenny',
  air_conditioning: 'Klimatyzacja',
};

export const pl = {
  errors,
  fields,
  status,
  timeline,
  features,
  errorMessage(code: string): string {
    return errors[code] ?? errors.UNKNOWN_ERROR;
  },
  fieldMessage(field: string, code: string): string {
    return fields[field]?.[code] ?? errors.VALIDATION_FAILED;
  },
  statusLabel(value: ReservationStatus, reason?: RejectionReason | null): string {
    if (value === 'Rejected' && reason === 'abandoned_by_guest') return 'Płatność przerwana';
    return status[value];
  },
  timelineLabel(eventType: EventType, reason?: RejectionReason | null): string {
    if (eventType === 'PaymentRejected' && reason === 'abandoned_by_guest') return 'Płatność przerwana';
    return timeline[eventType];
  },
  featureLabel(key: string): string {
    return features[key] ?? key;
  },
  nights(count: number): string {
    if (count === 1) return '1 noc';
    const lastDigit = count % 10;
    const lastTwo = count % 100;
    if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${count} noce`;
    return `${count} nocy`;
  },
  ui: {
    app: 'Rezerwacja pokoju',
    roomList: { title: 'Nasze pokoje', perNight: 'za noc', view: 'Zobacz pokój' },
    room: {
      features: 'Udogodnienia',
      perNight: 'za noc',
      chooseDates: 'Wybierz termin',
      back: 'Wszystkie pokoje',
    },
    book: {
      title: 'Termin i dane',
      weekdays: ['pn', 'wt', 'śr', 'cz', 'pt', 'so', 'nd'],
      pickCheckIn: 'Kliknij dzień przyjazdu',
      pickCheckOut: 'Teraz kliknij dzień wyjazdu',
      summary: 'Podsumowanie',
      checkIn: 'Przyjazd',
      checkOut: 'Wyjazd',
      total: 'Razem',
      guestName: 'Imię i nazwisko',
      guestEmail: 'Adres e-mail',
      submit: 'Przejdź do płatności',
      rangeBlocked: 'Wybrany zakres obejmuje zajętą noc. Wybierz inny termin.',
      tooManyNights: 'Pobyt może trwać najwyżej 30 nocy.',
      legendBlocked: 'zajęte',
      legendSelected: 'wybrane',
      backToRoom: 'Wróć do pokoju',
    },
    payment: {
      title: 'Operator płatności (symulacja)',
      amount: 'Kwota',
      stay: 'Termin',
      reservation: 'Rezerwacja',
      creating: 'trwa tworzenie…',
      delay: 'Opóźnienie odpowiedzi operatora',
      seconds: 's',
      pay: 'Zapłać',
      reject: 'Odrzuć płatność',
      abandon: 'Anuluj i wróć',
      expired: 'Rezerwacja wygasła, płatność nie została przyjęta.',
      backToRoom: 'Wróć do pokoju',
    },
    reservation: {
      waitingTitle: 'Oczekuje na płatność',
      waitingText: 'Czekamy na odpowiedź operatora płatności. Ta strona odświeży się sama.',
      saveTitle: 'Zapisz te dane',
      saveText: 'Link i kod bezpieczeństwa pokazujemy tylko raz. Będą potrzebne, żeby wrócić do rezerwacji.',
      link: 'Stały link',
      code: 'Kod bezpieczeństwa',
      copy: 'Kopiuj',
      copied: 'Skopiowano',
      details: 'Szczegóły rezerwacji',
      room: 'Pokój',
      checkIn: 'Przyjazd',
      checkOut: 'Wyjazd',
      from: 'od',
      to: 'do',
      nights: 'Liczba nocy',
      guest: 'Gość',
      email: 'E-mail',
      amount: 'Kwota',
      status: 'Status',
      history: 'Historia',
      cancel: 'Anuluj rezerwację',
      cancelling: 'Anulowanie…',
      notCancellableToday: 'Rezerwacji nie można anulować w dniu przyjazdu ani później.',
      refunded: 'Zwrot pełnej kwoty (symulowany):',
      rejectedText: 'Operator odrzucił płatność. Noce wróciły do puli; możesz zarezerwować ponownie.',
      abandonedText: 'Płatność została przerwana. Noce wróciły do puli.',
      expiredText: 'Rezerwacja wygasła, bo płatność nie dotarła w ciągu 15 minut.',
      cancelledText: 'Rezerwacja została anulowana.',
      bookAgain: 'Zarezerwuj ponownie',
      notFoundTitle: 'Nie znaleziono rezerwacji',
      notFoundText: 'Sprawdź, czy link jest kompletny.',
      rollbackCancel: 'Nie udało się anulować rezerwacji.',
      gateTitle: 'Podaj kod bezpieczeństwa',
      gateText: 'Kod otrzymałeś zaraz po rezerwacji.',
      gateSubmit: 'Pokaż rezerwację',
      attemptsLeft: (n: number) => `Błędny kod. Pozostałe próby: ${n}.`,
      lockedFor: (seconds: number) => `Za dużo prób. Spróbuj ponownie za ${Math.ceil(seconds / 60)} min.`,
    },
  },
};

export type Pl = typeof pl;
