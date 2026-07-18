export const copy = {
  en: {
    home: 'Home', games: 'Games', friends: 'Friends', chat: 'Chat', creator: 'Create', admin: 'Moderate', settings: 'Settings',
    search: 'Search games, creators or tags', play: 'Play', join: 'Join', favorite: 'Favorite', unfavorite: 'Favorited',
    featured: 'Featured', friendsPlaying: 'Friends playing', popular: 'Popular now', newGames: 'New on the deck', recently: 'Recently played',
    allGames: 'All games', noResults: 'No games match these filters.', players: 'players', reviews: 'reviews', by: 'by',
    viewGame: 'View game', request: 'Add friend', online: 'Online', offline: 'Offline', inGame: 'In game', party: 'Party',
    notifications: 'Notifications', profile: 'Profile', language: 'Language', privacy: 'Privacy', appearance: 'Appearance',
    save: 'Save changes', send: 'Send', report: 'Report', block: 'Block', approve: 'Approve', reject: 'Reject',
    pending: 'Pending', published: 'Published', draft: 'Draft', submitted: 'Submitted', requiredChanges: 'Changes required',
    launchWarning: 'You are opening a creator-hosted game in a new tab.', continue: 'Continue', cancel: 'Cancel',
    linkWarning: 'Check the address before leaving Gzowo’s Games.', deleteAccount: 'Delete account', exportData: 'Export my data'
  },
  pl: {
    home: 'Główna', games: 'Gry', friends: 'Znajomi', chat: 'Czat', creator: 'Twórz', admin: 'Moderacja', settings: 'Ustawienia',
    search: 'Szukaj gier, twórców lub tagów', play: 'Graj', join: 'Dołącz', favorite: 'Dodaj do ulubionych', unfavorite: 'W ulubionych',
    featured: 'Wyróżnione', friendsPlaying: 'Znajomi grają', popular: 'Popularne teraz', newGames: 'Nowe na platformie', recently: 'Ostatnio grane',
    allGames: 'Wszystkie gry', noResults: 'Żadna gra nie pasuje do filtrów.', players: 'graczy', reviews: 'opinii', by: 'od',
    viewGame: 'Zobacz grę', request: 'Dodaj znajomego', online: 'Online', offline: 'Offline', inGame: 'W grze', party: 'Grupa',
    notifications: 'Powiadomienia', profile: 'Profil', language: 'Język', privacy: 'Prywatność', appearance: 'Wygląd',
    save: 'Zapisz zmiany', send: 'Wyślij', report: 'Zgłoś', block: 'Zablokuj', approve: 'Zatwierdź', reject: 'Odrzuć',
    pending: 'Oczekuje', published: 'Opublikowana', draft: 'Szkic', submitted: 'Wysłana', requiredChanges: 'Wymaga zmian',
    launchWarning: 'Otwierasz grę hostowaną przez jej twórcę w nowej karcie.', continue: 'Kontynuuj', cancel: 'Anuluj',
    linkWarning: 'Sprawdź adres, zanim opuścisz Gzowo’s Games.', deleteAccount: 'Usuń konto', exportData: 'Pobierz moje dane'
  }
};

export const t = (state, key) => copy[state.settings.language]?.[key] ?? copy.en[key] ?? key;
