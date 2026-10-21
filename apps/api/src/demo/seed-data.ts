/** Fictional demo data for the Omaha scene (plus a couple of Lincoln spots outside the 20-mile radius). */

export const VENUES = [
  { slug: 'neon-mic', name: 'The Neon Mic', neighborhood: 'Old Market', city: 'Omaha', address: '1102 Howard St', lat: 41.2556, lng: -95.9322, hue: 320, capacity: 120, premiere: true, tagline: 'Brick walls, big voices', vibes: ['Divey', 'Rock', 'Late night'] },
  { slug: 'benson-bellow', name: 'Benson Bellow', neighborhood: 'Benson', city: 'Omaha', address: '6118 Maple St', lat: 41.2847, lng: -96.0067, hue: 190, capacity: 90, premiere: false, tagline: 'Where Benson belts it out', vibes: ['Indie', 'Punk-friendly', 'Patio'] },
  { slug: 'blackstone-social', name: 'Blackstone Social Club', neighborhood: 'Blackstone', city: 'Omaha', address: '3910 Farnam St', lat: 41.2587, lng: -95.9722, hue: 45, capacity: 140, premiere: true, tagline: 'Cocktails & crooners', vibes: ['Cocktails', 'Showtunes', 'Dressy'] },
  { slug: 'dundee-duet', name: 'Dundee Duet Lounge', neighborhood: 'Dundee', city: 'Omaha', address: '4964 Underwood Ave', lat: 41.2617, lng: -95.9893, hue: 260, capacity: 60, premiere: false, tagline: 'Two mics, no judgment', vibes: ['Duets', 'Cozy', 'Wine'] },
  { slug: 'midtown-encore', name: 'Midtown Encore', neighborhood: 'Midtown Crossing', city: 'Omaha', address: '3201 Farnam St', lat: 41.2582, lng: -95.9631, hue: 150, capacity: 160, premiere: false, tagline: 'Big stage, bigger crowd', vibes: ['Big stage', 'Pop', 'Groups'] },
  { slug: 'aksarben-amp', name: 'Aksarben Amp Room', neighborhood: 'Aksarben Village', city: 'Omaha', address: '2110 S 67th St', lat: 41.2402, lng: -96.0157, hue: 15, capacity: 110, premiere: false, tagline: 'Turn it up to eleven', vibes: ['Rock', 'Sports bar'] },
  { slug: 'nodo-note', name: 'NoDo Note', neighborhood: 'North Downtown', city: 'Omaha', address: '1213 Capitol Ave', lat: 41.2668, lng: -95.9337, hue: 210, capacity: 80, premiere: false, tagline: 'Hidden gem by the ballpark', vibes: ['Craft beer', 'Hip-hop nights'] },
  { slug: 'river-city-rumble', name: 'River City Rumble', neighborhood: 'Council Bluffs', city: 'Council Bluffs', address: '125 W Broadway', lat: 41.2617, lng: -95.8584, hue: 0, capacity: 130, premiere: false, tagline: 'Iowa side, Omaha soul', vibes: ['Country', 'Line dancing'] },
  { slug: 'papio-power-ballad', name: 'Papio Power Ballad', neighborhood: 'Papillion', city: 'Papillion', address: '110 N Washington St', lat: 41.1551, lng: -96.0428, hue: 285, capacity: 70, premiere: false, tagline: 'Ballads every night', vibes: ['80s', 'Ballads', 'Neighborhood'] },
  { slug: 'bellevue-backbeat', name: 'Bellevue Backbeat', neighborhood: 'Olde Towne', city: 'Bellevue', address: '2210 Main St', lat: 41.1372, lng: -95.8905, hue: 170, capacity: 85, premiere: false, tagline: 'Military town, mighty choruses', vibes: ['Classic rock', 'Darts'] },
  { slug: 'la-vista-lyric', name: 'La Vista Lyric Lounge', neighborhood: 'La Vista', city: 'La Vista', address: '8116 S 84th St', lat: 41.1839, lng: -96.0349, hue: 100, capacity: 75, premiere: false, tagline: 'Know the words? Prove it.', vibes: ['Trivia + karaoke', 'Families early'] },
  { slug: 'millard-mic-drop', name: 'Millard Mic Drop', neighborhood: 'Millard', city: 'Omaha', address: '13325 Millard Ave', lat: 41.2048, lng: -96.1256, hue: 340, capacity: 100, premiere: false, tagline: 'Drop the mic, not the drink', vibes: ['Sports bar', 'Pop'] },
  { slug: 'elkhorn-echo', name: 'Elkhorn Echo', neighborhood: 'Elkhorn', city: 'Omaha', address: '20220 Veterans Dr', lat: 41.2866, lng: -96.2368, hue: 230, capacity: 90, premiere: false, tagline: 'Out west, singing loud', vibes: ['Country', 'Patio'] },
  { slug: 'florence-falsetto', name: 'Florence Falsetto', neighborhood: 'Florence', city: 'Omaha', address: '8502 N 30th St', lat: 41.3381, lng: -95.9606, hue: 55, capacity: 55, premiere: false, tagline: 'Hit the high notes', vibes: ['Dive', 'Regulars'] },
  { slug: 'ralston-rhapsody', name: 'Ralston Rhapsody', neighborhood: 'Ralston', city: 'Ralston', address: '7640 Main St', lat: 41.2055, lng: -96.0421, hue: 125, capacity: 95, premiere: false, tagline: 'Bohemian since forever', vibes: ['Queen nights', 'Classic rock'] },
  { slug: 'haymarket-harmony', name: 'Haymarket Harmony', neighborhood: 'Haymarket', city: 'Lincoln', address: '701 P St', lat: 40.8152, lng: -96.7101, hue: 300, capacity: 120, premiere: false, tagline: 'Lincoln’s loudest Thursday', vibes: ['College', 'Pop'] },
  { slug: 'capitol-high-notes', name: 'Capitol High Notes', neighborhood: 'Downtown', city: 'Lincoln', address: '1400 O St', lat: 40.8136, lng: -96.7026, hue: 30, capacity: 80, premiere: false, tagline: 'High notes near the Capitol', vibes: ['Showtunes'] },
] as const;

export const KJS = [
  { handle: 'velvetvox', name: 'DJ Velvet Vox', emoji: '🎧', hue: 320, bio: 'Hosting the Old Market since 2011. Ask me for the deep cuts.', venues: ['neon-mic', 'nodo-note', 'blackstone-social'] },
  { handle: 'kjronnie', name: 'KJ Ronnie Reverb', emoji: '🎛️', hue: 200, bio: 'Gapless rotation or your money back (it’s free).', venues: ['benson-bellow', 'dundee-duet', 'florence-falsetto'] },
  { handle: 'mistressofmic', name: 'Mistress of the Mic', emoji: '👑', hue: 280, bio: 'Showtunes, drag nights and the occasional power ballad.', venues: ['blackstone-social', 'midtown-encore', 'papio-power-ballad'] },
  { handle: 'bigbluebeats', name: 'Big Blue Beats', emoji: '🔵', hue: 215, bio: 'Country, classic rock, and karaoke for the whole family.', venues: ['river-city-rumble', 'elkhorn-echo', 'bellevue-backbeat'] },
  { handle: 'kjsaltnpepa', name: 'KJ Salt-N-Pepa', emoji: '🧂', hue: 30, bio: 'Hip-hop and R&B nights. Bring your hype man.', venues: ['nodo-note', 'aksarben-amp', 'millard-mic-drop'] },
  { handle: 'echoecho', name: 'Echo Echo Entertainment', emoji: '📢', hue: 160, bio: 'Two-person crew running west Omaha’s best nights.', venues: ['elkhorn-echo', 'millard-mic-drop', 'la-vista-lyric', 'ralston-rhapsody'] },
  { handle: 'capitolkj', name: 'Capitol City KJ', emoji: '🏛️', hue: 45, bio: 'Lincoln karaoke lifer.', venues: ['haymarket-harmony', 'capitol-high-notes'] },
];

/** [venue slug, day of week (0=Sun), start "HH:MM", end "HH:MM" (may pass midnight), kj handle] */
export const NIGHTS: [string, number, string, string, string][] = [
  ['neon-mic', 3, '21:00', '01:00', 'velvetvox'], ['neon-mic', 5, '21:00', '02:00', 'velvetvox'], ['neon-mic', 6, '21:00', '02:00', 'velvetvox'], ['neon-mic', 1, '20:00', '00:00', 'velvetvox'],
  ['benson-bellow', 2, '21:00', '01:00', 'kjronnie'], ['benson-bellow', 4, '21:00', '01:00', 'kjronnie'], ['benson-bellow', 6, '21:30', '02:00', 'kjronnie'],
  ['blackstone-social', 4, '20:00', '00:00', 'mistressofmic'], ['blackstone-social', 5, '20:00', '00:00', 'velvetvox'], ['blackstone-social', 0, '19:00', '23:00', 'mistressofmic'],
  ['dundee-duet', 3, '19:30', '23:30', 'kjronnie'], ['dundee-duet', 5, '20:00', '00:00', 'kjronnie'],
  ['midtown-encore', 5, '21:00', '02:00', 'mistressofmic'], ['midtown-encore', 6, '21:00', '02:00', 'mistressofmic'], ['midtown-encore', 2, '20:00', '00:00', 'mistressofmic'],
  ['aksarben-amp', 4, '21:00', '01:00', 'kjsaltnpepa'], ['aksarben-amp', 6, '21:00', '01:00', 'kjsaltnpepa'],
  ['nodo-note', 1, '21:00', '01:00', 'kjsaltnpepa'], ['nodo-note', 3, '21:00', '01:00', 'velvetvox'], ['nodo-note', 5, '22:00', '02:00', 'kjsaltnpepa'],
  ['river-city-rumble', 4, '20:00', '00:00', 'bigbluebeats'], ['river-city-rumble', 5, '20:00', '01:00', 'bigbluebeats'], ['river-city-rumble', 6, '20:00', '01:00', 'bigbluebeats'],
  ['papio-power-ballad', 2, '19:00', '23:00', 'mistressofmic'], ['papio-power-ballad', 5, '20:00', '00:00', 'mistressofmic'],
  ['bellevue-backbeat', 3, '20:00', '00:00', 'bigbluebeats'], ['bellevue-backbeat', 6, '20:00', '01:00', 'bigbluebeats'],
  ['la-vista-lyric', 4, '19:00', '23:00', 'echoecho'], ['la-vista-lyric', 0, '17:00', '21:00', 'echoecho'],
  ['millard-mic-drop', 3, '20:00', '00:00', 'echoecho'], ['millard-mic-drop', 5, '21:00', '01:00', 'kjsaltnpepa'],
  ['elkhorn-echo', 4, '20:00', '00:00', 'bigbluebeats'], ['elkhorn-echo', 6, '20:00', '00:00', 'echoecho'],
  ['florence-falsetto', 1, '19:00', '23:00', 'kjronnie'], ['florence-falsetto', 0, '15:00', '20:00', 'kjronnie'],
  ['ralston-rhapsody', 2, '20:00', '00:00', 'echoecho'], ['ralston-rhapsody', 6, '20:00', '00:00', 'echoecho'],
  ['haymarket-harmony', 4, '21:00', '01:00', 'capitolkj'], ['capitol-high-notes', 5, '20:00', '00:00', 'capitolkj'],
];

export const SPECIALS: [string, string, string, string, number[]][] = [
  ['neon-mic', '$3 Wells', '$3', 'All night during karaoke', [1, 3, 5, 6]],
  ['neon-mic', 'Fireball Fridays', '$4', 'Liquid courage shots', [5]],
  ['benson-bellow', 'Tallboy + Taco', '$7', 'Any tallboy with a street taco', [2, 4]],
  ['blackstone-social', 'Showstopper Martini', '$8', 'Espresso or classic, your call', [4, 5, 0]],
  ['dundee-duet', 'Duet Bottles', '$20', 'Two glasses, one bottle, one song', [3, 5]],
  ['midtown-encore', 'Pitcher Power Hour', '$10', '9–10pm domestic pitchers', [2, 5, 6]],
  ['aksarben-amp', 'Wing Night', '50¢', 'Wings while you wait for your turn', [4]],
  ['nodo-note', 'Local Draft Flight', '$9', 'Four Omaha brews', [1, 3, 5]],
  ['river-city-rumble', 'Boot Shots', '$5', 'Served in a tiny boot', [4, 5, 6]],
  ['papio-power-ballad', 'Power Ballad Punch', '$6', 'Big hair not required', [2, 5]],
  ['ralston-rhapsody', 'Galileo Lager', '$4', 'Scaramouche approved', [2, 6]],
  ['millard-mic-drop', 'Mic Drop Mule', '$6', 'Copper mug included (please return)', [3, 5]],
];

export const SINGER_NAMES = [
  ['Jess Alvarez', '🌵'], ['Marcus Bell', '🎷'], ['Priya Shah', '🌸'], ['Tommy Nguyen', '🐉'], ['Kayla Brooks', '💅'],
  ['Devon Carter', '🕶️'], ['Hannah Olsen', '🌻'], ['Luis Romero', '🎺'], ['Sam Whitaker', '🎸'], ['Aisha Johnson', '✨'],
  ['Ben Kowalski', '🍺'], ['Chloe Martin', '🦋'], ['Ray Delgado', '🔥'], ['Megan Fry', '🍒'], ['Andre Lewis', '👑'],
  ['Olivia Park', '🌙'], ['Chris Hansen', '🌽'], ['Tasha Green', '💚'], ['Nate Fischer', '🐟'], ['Rosa Jimenez', '🌹'],
  ['Kyle Peters', '🏈'], ['Brittany Lane', '💖'], ['Omar Haddad', '🌟'], ['Grace Lindgren', '❄️'], ['Jamal Wright', '🎤'],
  ['Emily Novak', '🎀'], ['Derek Sloan', '🤠'], ['Lily Tran', '🌺'], ['Victor Ruiz', '🎻'], ['Zoe Bennett', '🪩'],
  ['Hank Morrison', '🦬'], ['Nina Patel', '🪷'], ['Tyler Reed', '⚡'], ['Carmen Ortiz', '💃'], ['Josh Lindqvist', '🎹'],
  ['Dana Kim', '🍜'], ['Frankie Moretti', '🍝'], ['Ivy Chen', '🌿'], ['Wes Harmon', '🎶'], ['Gabby Simmons', '🍭'],
];

export const BIOS = [
  'Power ballads are my cardio.', 'Will sing Bohemian Rhapsody if dared.', 'Shy until the chorus hits.', 'Former choir kid, current bar legend.',
  'I do Dolly better than Dolly (don’t tell her).', 'Duet partner wanted. Must know all the words to Islands in the Stream.', 'Here for the vibes and the wings.',
  'Taking requests: anything with a key change.', 'Hip-hop verses, R&B hooks.', 'Country on Thursdays, rock on Saturdays.', 'Every Wednesday at the Neon Mic, rain or shine.',
  'I learned English from Backstreet Boys songs.', 'Mom of 3, queen of Heart covers.', 'Sings mostly in the shower and at the Bellow.',
];

export const NIGHTS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const AGE_RANGES = ['21–24', '25–29', '30–34', '35–44', '45–54', '55+'];
export const HOMETOWNS = ['Omaha, NE', 'Council Bluffs, IA', 'Lincoln, NE', 'Bellevue, NE', 'Papillion, NE', 'Des Moines, IA', 'Kansas City, MO', 'Sioux City, IA', 'Grand Island, NE', 'Denver, CO'];

/** title | artist | genre | year */
export const SONGS = `
Bohemian Rhapsody|Queen|Rock|1975
Don't Stop Me Now|Queen|Rock|1979
Somebody to Love|Queen|Rock|1976
Don't Stop Believin'|Journey|Rock|1981
Livin' on a Prayer|Bon Jovi|Rock|1986
Total Eclipse of the Heart|Bonnie Tyler|Pop|1983
I Wanna Dance with Somebody|Whitney Houston|Pop|1987
I Will Always Love You|Whitney Houston|R&B|1992
Sweet Caroline|Neil Diamond|Pop|1969
Mr. Brightside|The Killers|Rock|2004
Wonderwall|Oasis|Rock|1995
Africa|Toto|Rock|1982
Islands in the Stream|Kenny Rogers & Dolly Parton|Country|1983
Jolene|Dolly Parton|Country|1973
9 to 5|Dolly Parton|Country|1980
Friends in Low Places|Garth Brooks|Country|1990
Before He Cheats|Carrie Underwood|Country|2006
Man! I Feel Like a Woman!|Shania Twain|Country|1999
Any Man of Mine|Shania Twain|Country|1995
Wagon Wheel|Darius Rucker|Country|2013
Tennessee Whiskey|Chris Stapleton|Country|2015
Take Me Home, Country Roads|John Denver|Country|1971
Ring of Fire|Johnny Cash|Country|1963
Folsom Prison Blues|Johnny Cash|Country|1955
Girls Just Want to Have Fun|Cyndi Lauper|Pop|1983
Like a Prayer|Madonna|Pop|1989
Since U Been Gone|Kelly Clarkson|Pop|2004
Shallow|Lady Gaga & Bradley Cooper|Pop|2018
Bad Romance|Lady Gaga|Pop|2009
Rolling in the Deep|Adele|Pop|2010
Someone Like You|Adele|Pop|2011
Valerie|Amy Winehouse|Soul|2007
Rehab|Amy Winehouse|Soul|2006
Respect|Aretha Franklin|Soul|1967
Proud Mary|Tina Turner|Soul|1971
What's Love Got to Do with It|Tina Turner|Pop|1984
Dancing Queen|ABBA|Pop|1976
Mamma Mia|ABBA|Pop|1975
Waterloo|ABBA|Pop|1974
I Will Survive|Gloria Gaynor|Disco|1978
September|Earth, Wind & Fire|Funk|1978
Uptown Funk|Mark Ronson ft. Bruno Mars|Funk|2014
Billie Jean|Michael Jackson|Pop|1982
Man in the Mirror|Michael Jackson|Pop|1988
Purple Rain|Prince|Rock|1984
Kiss|Prince|Funk|1986
Hey Ya!|OutKast|Hip-Hop|2003
Ms. Jackson|OutKast|Hip-Hop|2000
Gin and Juice|Snoop Dogg|Hip-Hop|1994
Baby Got Back|Sir Mix-a-Lot|Hip-Hop|1992
Ice Ice Baby|Vanilla Ice|Hip-Hop|1990
Lose Yourself|Eminem|Hip-Hop|2002
The Real Slim Shady|Eminem|Hip-Hop|2000
No Diggity|Blackstreet|R&B|1996
Waterfalls|TLC|R&B|1995
No Scrubs|TLC|R&B|1999
Crazy in Love|Beyoncé|R&B|2003
Single Ladies|Beyoncé|R&B|2008
Love on Top|Beyoncé|R&B|2011
Halo|Beyoncé|Pop|2008
Umbrella|Rihanna|Pop|2007
Toxic|Britney Spears|Pop|2003
...Baby One More Time|Britney Spears|Pop|1998
I Want It That Way|Backstreet Boys|Pop|1999
Bye Bye Bye|*NSYNC|Pop|2000
Wannabe|Spice Girls|Pop|1996
Torn|Natalie Imbruglia|Pop|1997
Kiss Me|Sixpence None the Richer|Pop|1997
Bitch|Meredith Brooks|Rock|1997
You Oughta Know|Alanis Morissette|Rock|1995
Ironic|Alanis Morissette|Rock|1995
Zombie|The Cranberries|Rock|1994
Creep|Radiohead|Rock|1992
Smells Like Teen Spirit|Nirvana|Rock|1991
Black Hole Sun|Soundgarden|Rock|1994
Basket Case|Green Day|Punk|1994
All the Small Things|blink-182|Punk|1999
Mr. Jones|Counting Crows|Rock|1993
Semi-Charmed Life|Third Eye Blind|Rock|1997
Fat Lip|Sum 41|Punk|2001
Welcome to the Black Parade|My Chemical Romance|Rock|2006
Misery Business|Paramore|Rock|2007
Since You've Been Gone|Rainbow|Rock|1979
Sweet Child o' Mine|Guns N' Roses|Rock|1987
Paradise City|Guns N' Roses|Rock|1987
You Shook Me All Night Long|AC/DC|Rock|1980
Pour Some Sugar on Me|Def Leppard|Rock|1987
Here I Go Again|Whitesnake|Rock|1987
Alone|Heart|Rock|1987
Barracuda|Heart|Rock|1977
Edge of Seventeen|Stevie Nicks|Rock|1981
Dreams|Fleetwood Mac|Rock|1977
Landslide|Fleetwood Mac|Rock|1975
Go Your Own Way|Fleetwood Mac|Rock|1977
Hotel California|Eagles|Rock|1976
Piano Man|Billy Joel|Pop|1973
Uptown Girl|Billy Joel|Pop|1983
Tiny Dancer|Elton John|Pop|1971
Rocket Man|Elton John|Pop|1972
Your Song|Elton John|Pop|1970
Love Shack|The B-52's|Rock|1989
Come On Eileen|Dexys Midnight Runners|Pop|1982
Take On Me|a-ha|Pop|1985
Never Gonna Give You Up|Rick Astley|Pop|1987
Don't You (Forget About Me)|Simple Minds|Rock|1985
Footloose|Kenny Loggins|Pop|1984
Danger Zone|Kenny Loggins|Rock|1986
Eye of the Tiger|Survivor|Rock|1982
Separate Ways|Journey|Rock|1983
Faithfully|Journey|Rock|1983
I Love Rock 'n' Roll|Joan Jett & the Blackhearts|Rock|1981
Summer of '69|Bryan Adams|Rock|1984
Heaven|Bryan Adams|Rock|1984
Unchained Melody|The Righteous Brothers|Oldies|1965
Stand by Me|Ben E. King|Oldies|1961
Hound Dog|Elvis Presley|Oldies|1956
Can't Help Falling in Love|Elvis Presley|Oldies|1961
Suspicious Minds|Elvis Presley|Oldies|1969
Fly Me to the Moon|Frank Sinatra|Standards|1964
New York, New York|Frank Sinatra|Standards|1977
My Way|Frank Sinatra|Standards|1969
Feeling Good|Michael Bublé|Standards|2005
At Last|Etta James|Soul|1960
Defying Gravity|Wicked Cast|Showtunes|2003
Don't Rain on My Parade|Barbra Streisand|Showtunes|1964
Memory|Cats Cast|Showtunes|1981
Seasons of Love|Rent Cast|Showtunes|1996
This Is Me|Keala Settle|Showtunes|2017
Let It Go|Idina Menzel|Showtunes|2013
A Whole New World|Aladdin Cast|Showtunes|1992
Shake It Off|Taylor Swift|Pop|2014
Love Story|Taylor Swift|Country|2008
You Belong with Me|Taylor Swift|Country|2008
Anti-Hero|Taylor Swift|Pop|2022
drivers license|Olivia Rodrigo|Pop|2021
good 4 u|Olivia Rodrigo|Pop|2021
Flowers|Miley Cyrus|Pop|2023
Party in the U.S.A.|Miley Cyrus|Pop|2009
Espresso|Sabrina Carpenter|Pop|2024
Good Luck, Babe!|Chappell Roan|Pop|2024
HOT TO GO!|Chappell Roan|Pop|2023
Pink Pony Club|Chappell Roan|Pop|2020
Levitating|Dua Lipa|Pop|2020
Dancing On My Own|Robyn|Pop|2010
Mr. Blue Sky|Electric Light Orchestra|Rock|1977
Old Town Road|Lil Nas X|Country|2019
Truth Hurts|Lizzo|Pop|2017
Shut Up and Dance|Walk the Moon|Pop|2014
Hey Jude|The Beatles|Rock|1968
Twist and Shout|The Beatles|Rock|1963
Let It Be|The Beatles|Rock|1970
Wild Thing|The Troggs|Rock|1966
Brown Eyed Girl|Van Morrison|Rock|1967
Gimme! Gimme! Gimme!|ABBA|Disco|1979
Rhinestone Cowboy|Glen Campbell|Country|1975
`
  .trim()
  .split('\n')
  .map((l) => l.split('|'))
  .map(([title, artist, genre, year]) => ({ title, artist, genre, year: Number(year) }));

export const PRAISE_LINES = [
  ['🔥', 'Absolutely brought the house down'],
  ['🎯', 'Nailed every note, unreal'],
  ['💃', 'Got the whole room dancing'],
  ['🥹', 'Gave me actual chills'],
  ['🎸', 'Pure rock star energy'],
  ['👏', 'Brave song choice, totally owned it'],
  ['🌟', 'That key change though!!'],
  ['💖', 'Best duet partner in Omaha'],
  ['🙌', 'Crowd was chanting your name'],
  ['😂', 'Most fun performance of the night'],
];

export const GALLERY_CAPTIONS = [
  ['📸', 'Saturday night packed house'], ['🎤', 'Bohemian Rhapsody group sing'], ['🪩', 'Disco ball doing its thing'],
  ['🎉', 'Birthday squad takeover'], ['🤠', 'Line dance break'], ['🎸', 'Air guitar solo of the year'],
  ['💃', 'Dance floor at midnight'], ['🏆', 'Karaoke Cup finalists'], ['🌈', 'Pride night duets'], ['🍻', 'Cheers to the regulars'],
];

/** Extra background singers so every live night has a believable crowd. */
const FIRST = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Jamie', 'Avery', 'Quinn', 'Parker', 'Drew', 'Reese', 'Skyler', 'Cameron', 'Logan', 'Harper', 'Rowan', 'Blake', 'Shawn', 'Kendall', 'Micah', 'Toni', 'Bailey', 'Emerson', 'Sage'];
const LAST = ['Anderson', 'Schmidt', 'Johnson', 'Larsen', 'Meyer', 'Svoboda', 'Ramirez', 'Kaufman', 'Novotny', 'Hoffman', 'Weber', 'Dvorak', 'Jensen', 'Garcia', 'Murphy'];
const EMOJI = ['🎵', '🎶', '🌈', '🍕', '🐱', '🦊', '🌮', '🍀', '🎲', '🛼', '🧃', '🌶️', '🐝', '🍉', '🎈'];
export const EXTRA_SINGERS: [string, string][] = Array.from({ length: 74 }, (_, i) => [`${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`, EMOJI[i % EMOJI.length]]);
