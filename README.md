# Registrul meu

Aplicație web privată, optimizată pentru telefon, pentru evidența veniturilor,
cheltuielilor și bonurilor fotografiate. Fiecare persoană își creează propriul
cont cu e-mail și parolă, iar datele se sincronizează între dispozitive prin
Supabase.

## Funcții

- formular pentru venituri și cheltuieli;
- totaluri și sold în lei;
- istoric grupat pe zile;
- fotografierea bonurilor direct de pe telefon;
- arhivă privată de dovezi, organizată după dată.

## Configurare

1. Creează un proiect Supabase.
2. Rulează `supabase/schema.sql` în SQL Editor.
3. Adaugă `NEXT_PUBLIC_SUPABASE_URL` și `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` în
   GitHub Actions Secrets.
4. Activează GitHub Pages cu sursa „GitHub Actions”.

Cheia `anon` este cheia publică a aplicației. Securitatea datelor este aplicată
în baza de date prin Row Level Security: un utilizator autentificat poate citi
și modifica numai rândurile și fotografiile care îi aparțin.
