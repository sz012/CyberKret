import { useEffect } from 'react'
import { Icon } from '../components/icons'
import { BrandMark } from '../components/BrandMark'
import Mascot from '../components/Mascot'
import './landing.css'
import PlotTwist from './PlotTwist'

const MINI = [
  { id: 'siec', label: 'Sieć', x: 70, y: 150, st: 'bad', icon: 'router' },
  { id: 'komp', label: 'Komputery', x: 150, y: 250, st: 'bad', icon: 'laptop' },
  { id: 'konta', label: 'Konta', x: 260, y: 300, st: 'bad', icon: 'key' },
  { id: 'poczta', label: 'Poczta', x: 380, y: 300, st: 'warn', icon: 'mail' },
  { id: 'kopie', label: 'Kopie', x: 490, y: 250, st: 'warn', icon: 'disk' },
  { id: 'www', label: 'Strona', x: 570, y: 150, st: 'ok', icon: 'globe' },
]

function MiniMap() {
  const hub = { x: 320, y: 70 }
  return (
    <svg className="mini-map" viewBox="0 0 640 380" role="img" aria-label="Kable od patch panelu do sześciu miejsc. Czerwony tunel prowadzi z internetu przez sieć i komputery do akt klientów.">
      <rect width="640" height="380" rx="16" fill="#0d0f13" />
      <rect y="0" width="640" height="44" fill="#171a20" />
      <rect y="40" width="640" height="6" fill="#2f3542" />
      {MINI.map((c, i) => {
        const d = `M${hub.x} ${hub.y + 10} C ${hub.x} ${hub.y + 60}, ${c.x} ${c.y - 80}, ${c.x} ${c.y - 26}`
        return (
          <g key={c.id} className={`mm-cable mm-${c.st}`} style={{ animationDelay: `${i * 0.5}s` }}>
            <path d={d} className="mm-sheath" />
            <path d={d} className="mm-core" />
            <path d={d} className="mm-pulse" style={{ animationDelay: `${i * 0.5}s` }} />
          </g>
        )
      })}
      <rect x={hub.x - 56} y={hub.y - 12} width="112" height="24" rx="5" fill="#1d2129" stroke="#4a5262" />
      <path d="M28 20 C 20 90, 40 120, 70 150 S 130 230, 150 250 S 140 330, 150 350" className="mm-tunnel" />
      {MINI.map((c) => (
        <g key={c.id} transform={`translate(${c.x} ${c.y})`} className={`mm-ch mm-${c.st}`}>
          <rect x="-24" y="-24" width="48" height="48" rx="12" />
          <g transform="translate(-11 -11)"><Icon name={c.icon} size={22} /></g>
          <text y="42" textAnchor="middle">{c.label}</text>
        </g>
      ))}
      <g transform="translate(150 350)" className="mm-target">
        <rect x="-62" y="-16" width="124" height="30" rx="8" />
        <text y="4" textAnchor="middle">Akta klientów</text>
      </g>
      <text x="28" y="30" className="mm-small">INTERNET</text>
    </svg>
  )
}

export default function Landing() {
  useEffect(() => {
    document.title = 'CyberKret · Lepiej, żeby pierwszy był Twój kret'
  }, [])

  return (
    <div className="landing">
      <nav className="lnav">
        <a href="#top" className="brand">
          <BrandMark size={40} />
          <b>CyberKret</b>
        </a>
        <div className="lnav-links">
          <a href="#problem">Problem</a>
          <a href="#jak">Jak działa</a>
          <a href="#lokalnie">Dlaczego lokalnie</a>
          <a href="#uczciwie">Co jest prawdziwe</a>
        </div>
        <a className="btn btn-lamp btn-sm" href="/app">Otwórz demo</a>
      </nav>

      <div id="top"><PlotTwist /></div>

      <section className="lsec intro">
        <div className="lwrap intro-grid">
          <div>
            <span className="eyebrow lamp">HackYeah 2026 · Obronność · dla małych firm</span>
            <h2 className="big">Lepiej, żeby pierwszy był <em>Twój kret.</em></h2>
          </div>
          <p className="lead">
            <b>CyberKret to kret, którego mała organizacja sama wpuszcza do swoich systemów, zanim zrobi to prawdziwy.</b>{' '}
            Pokazuje, którędy wszedłby atakujący i co zamknąć najpierw. A gdy coś się stanie, prowadzi przez incydent tak, żeby najważniejsza praca nie stanęła.
          </p>
        </div>
      </section>

      <section className="lsec" id="problem">
        <div className="lwrap">
          <span className="depth">0,5 m pod podłogą · problem</span>
          <h2>Dane jak w banku, ochrona jak w kiosku.</h2>
          <p className="sub">Kancelaria czy biuro rachunkowe trzyma tajemnice klientów. Nie ma działu IT, a atakujący zawsze szukają najsłabszego ogniwa.</p>
          <div className="facts4">
            <div><Icon name="shield" size={26} className="lamp" /><h3>Nikt nie pilnuje</h3><p>IT robi siostrzeniec szefa albo firma z zewnątrz raz na kwartał. Nikt nie wie, co jest otwarte.</p></div>
            <div><Icon name="mail" size={26} className="lamp" /><h3>Phishing trafia w ludzi</h3><p>Fałszywa faktura i „nowy numer konta”. Wystarczy jeden przelew z księgowości.</p></div>
            <div><Icon name="cloud" size={26} className="lamp" /><h3>Chmura odpada</h3><p>Tajemnica zawodowa i RODO nie pozwalają wysłać maili klientów do zewnętrznego AI.</p></div>
            <div><Icon name="alert" size={26} className="lamp" /><h3>Po ataku panika</h3><p>Brak procedury, nie wiadomo, kogo zawiadomić. Często pada też poczta i internet.</p></div>
          </div>
        </div>
      </section>

      <section className="lsec" id="jak">
        <div className="lwrap">
          <span className="depth">1,5 m · jak to działa</span>
          <h2>Trzy rzeczy, które robi kret.</h2>

          <div className="feat">
            <div className="feat-copy">
              <span className="num">1</span>
              <h3>Tunele</h3>
              <p>Każda rzecz, którą kret sprawdza, to osobny kabel. Kret jedzie nim pod podłogą aż do końca, a kabel zapala się na zielono, żółto albo czerwono.</p>
              <ul>
                <li><b>Łączy fakty.</b> Otwarty pulpit zdalny i wspólne hasło admina to osobno dwie wpadki. Razem: prosta droga z internetu do akt klientów.</li>
                <li><b>Zamiast raportu na 40 stron:</b> trzy ruchy na ten tydzień, od tego, który zamyka najwięcej.</li>
                <li><b>Mówi, skąd wie:</b> sprawdził kret, z Twoich odpowiedzi albo niepotwierdzone.</li>
              </ul>
            </div>
            <div className="feat-visual card"><MiniMap /></div>
          </div>

          <div className="feat flip">
            <div className="feat-copy">
              <span className="num">2</span>
              <h3>Kret pocztowy</h3>
              <p>Pani Grażyna z księgowości dostaje maila. Zanim go otworzy, kret już go przeczytał.</p>
              <ul>
                <li><b>Sprawdza fakty:</b> prawdziwą domenę nadawcy, dokąd prowadzą linki, co naprawdę siedzi w załączniku.</li>
                <li><b>Załączniki otwiera u siebie w norze</b>, jako tekst. Nic nie jest uruchamiane na komputerze pracownika.</li>
                <li><b>Tłumaczy po ludzku</b> i mówi, co zrobić: „Nie płać. Zadzwoń na numer z umowy.”</li>
              </ul>
            </div>
            <div className="feat-visual card mailmock">
              <div className="mm-head"><span>Skrzynka · Grażyna Kowalska</span><span className="pill bad"><span className="dot" />nie otwieraj, zgłoś</span></div>
              <div className="mm-meta">
                <div><span className="muted">Od:</span> Biurex Hurtownia &lt;faktury@<span className="flag">biurex-pl.example</span>&gt;</div>
                <b>Aktualizacja numeru rachunku - FV/09/2026</b>
              </div>
              <div className="mm-stop">
                <div className="row gap-sm"><Mascot size={60} pose="alarm" badge={false} cable={false} /><strong>Stop. Kret znalazł 3 sygnały oszustwa.</strong></div>
                <ol>
                  <li>Biurex pisze z biurex.example. Ten mail przyszedł z podróbki.</li>
                  <li>„PDF” to strona z formularzem logowania do banku.</li>
                  <li>Zmiana numeru konta i „pilne, do końca dnia”.</li>
                </ol>
                <p><b>Co zrobić:</b> nie płać. Zadzwoń do Biurex na numer z umowy.</p>
              </div>
            </div>
          </div>

          <div className="feat">
            <div className="feat-copy">
              <span className="num">3</span>
              <h3>Tryb incydentu</h3>
              <p>Gdy coś się już stało, liczą się minuty. Jeden przycisk, pięć prostych pytań i plan dopasowany do tej firmy i tego ataku.</p>
              <ul>
                <li><b>Najpierw to, co bezpieczne zawsze.</b> Kroki, które pomagają bez względu na przyczynę, idą na górę.</li>
                <li><b>Plan zmienia się po każdym fakcie.</b> „Przelew już wyszedł” i od razu: telefon do banku, zgłoszenie na policję.</li>
                <li><b>Ciągłość:</b> termin w sądzie jutro 10:00? Pismo z kopii offline. „Działamy” dopiero po potwierdzeniu.</li>
                <li><b>Zegar 72 h</b> na zgłoszenie do UODO, gdy dane klientów mogły wyciec.</li>
              </ul>
            </div>
            <div className="feat-visual card incmock">
              <div className="mm-head"><span>Incydent · fałszywa faktura</span><span className="mono bad">UODO 71:42:09</span></div>
              <ol className="incmock-steps">
                <li className="done"><span>✓</span><div><b>Wstrzymaj przelewy na nowe numery</b><small>Grażyna · bezpieczne zawsze</small></div></li>
                <li className="done"><span>✓</span><div><b>Zadzwoń do kontrahenta na numer z umowy</b><small>Grażyna · bezpieczne zawsze</small></div></li>
                <li className="new"><span /><div><b>Dzwoń do banku: zatrzymanie przelewu</b><small>nowy fakt: przelew wyszedł wczoraj</small></div></li>
                <li><span /><div><b>Zgłoś fałszywą domenę do CERT Polska</b><small>Anna · w ciągu godziny</small></div></li>
              </ol>
              <div className="incmock-foot">
                <span className="pill bad"><span className="dot" />internet: brak</span>
                <span className="pill ok"><span className="dot" />kret: działa lokalnie</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="lsec" id="lokalnie">
        <div className="lwrap">
          <span className="depth">fundament · dlaczego lokalnie</span>
          <h2>Twoje dane nie wychodzą z nory.</h2>
          <p className="sub">Mózg kreta to model językowy uruchomiony na jednym komputerze w biurze. Tylko tak kancelaria w ogóle może użyć AI do swoich danych.</p>
          <div className="local2">
            <div className="office2">
              <span className="eyebrow lamp">Biuro · sieć lokalna</span>
              <div className="boxes">
                <div><b>Komputery</b><span>zapora, szyfrowanie, aktualizacje</span></div>
                <div><b>Skrzynki</b><span>maile i załączniki</span></div>
                <div><b>Ludzie</b><span>odpowiedzi, zgłoszenia</span></div>
              </div>
              <div className="server2">
                <span className="eyebrow">Serwer CyberKret</span>
                <h3>Qwen 3.6, lokalnie przez Ollamę</h3>
                <p className="muted">Reguły i testy zbierają fakty. Model je czyta i tłumaczy po polsku. Decyzje o dziurach podejmuje silnik, nie model.</p>
                <div className="row gap-sm wrap"><span className="pill lamp">48 GB RAM</span><span className="pill lamp">działa offline</span><span className="pill lamp">bez kont w chmurze</span></div>
              </div>
            </div>
            <div className="cloud2">
              <span className="eyebrow">Internet i chmura AI</span>
              <span className="zero">0 bajtów</span>
              <p className="muted">Tyle danych klientów trafia na zewnątrz. Można to pokazać inspektorowi ochrony danych.</p>
            </div>
          </div>
          <div className="why3">
            <div><h3>Tajemnica zawodowa</h3><p>Maile klientów, akta i wyniki skanów przetwarza model w tym samym pokoju.</p></div>
            <div><h3>Działa, gdy nic nie działa</h3><p>Brak internetu nie wyłącza poradnika. W incydencie to najważniejsze.</p></div>
            <div><h3>Fakty, nie zgadywanie</h3><p>Każdy werdykt cytuje dowód: port, nagłówek, rekord DNS. Model nie może obniżyć alarmu, który podniosły testy.</p></div>
          </div>
        </div>
      </section>

      <section className="lsec" id="uczciwie">
        <div className="lwrap">
          <span className="depth">bez ściemy</span>
          <h2>Co w prototypie jest prawdziwe, a co symulowane.</h2>
          <div className="honest">
            <div className="card card-pad">
              <h3 className="ok">Prawdziwe</h3>
              <ul>
                <li>Silnik ścieżek ataku i „zasyp najpierw” (graf, algorytm zachłanny)</li>
                <li>Pasywne sprawdzenie domeny: SPF, DMARC, DKIM, HTTPS, nagłówki</li>
                <li>Lokalny agent: zapora, FileVault, aktualizacje na tym komputerze</li>
                <li>Analiza plików .eml: nagłówki, podróbki domen, linki, załączniki</li>
                <li>Lokalny model przez Ollamę, z trybem awaryjnym bez modelu</li>
                <li>Poradnik incydentu, który przebudowuje plan po każdym fakcie</li>
              </ul>
            </div>
            <div className="card card-pad">
              <h3 className="warn">Symulowane</h3>
              <ul>
                <li>Mapa Kancelarii Nowak: fikcyjna firma z danymi z ankiety</li>
                <li>Skrzynka Pani Grażyny: przykładowe maile w domenach .example</li>
                <li>Aktywnych testów (porty, logowanie) celowo nie robimy: tylko za zgodą właściciela, w przyszłej wersji</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="lsec" id="dla-kogo">
        <div className="lwrap">
          <span className="depth">dla kogo</span>
          <h2>Dla firm, które mają najwięcej do stracenia, a nie mają działu IT.</h2>
          <div className="who">
            {['Kancelarie', 'Biura rachunkowe', 'Doradcy podatkowi', 'Notariusze', 'Gabinety medyczne', 'Fundacje', 'Firmy 3-50 osób'].map((w) => <span key={w}>{w}</span>)}
          </div>
        </div>
      </section>

      <footer className="lfinal">
        <div className="lwrap final-grid">
          <div className="stack">
            <span className="eyebrow">CyberKret</span>
            <h2 className="big">Wpuść kreta, <em>zanim zrobi to ktoś inny.</em></h2>
            <div><a className="btn btn-lamp btn-lg" href="/app">Zobacz, jak ryje ▸</a></div>
          </div>
          <Mascot size={260} pose="happy" />
        </div>
        <div className="lwrap foot">
          <span>Prototyp na HackYeah 2026, zadanie Defence.</span>
          <span>Maskotka i grafiki: projekt własny. Dane w przykładach są fikcyjne.</span>
        </div>
      </footer>
    </div>
  )
}
