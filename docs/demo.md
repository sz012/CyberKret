# cyberMole demo

`/demo` (http://localhost:5173/demo) plays a 96-second story: the opening animation, then the fictional Nowak Law Office going through the app. It reads `/api/demo/presentation`, which runs the same rules as the app on the demo files. It does not reset the database, scan anything or change safeguards, and it does not call the language model.

| Time | Scene | What it shows |
| --- | --- | --- |
| 0:00-0:18 | Night at the office | The opening animation from the home page. |
| 0:18-0:29 | Your company | Eight people, client files, money, business continuity. |
| 0:29-0:46 | Attack path | Five attack paths, one of them from the internet to client files. |
| 0:46-0:55 | First move | Hiding remote desktop closes two of the five paths. |
| 0:55-1:12 | Suspicious email | Lookalike domain, new account number, an attachment posing as a PDF. |
| 1:12-1:25 | Action plan | Nobody has paid yet. Grace holds payments and calls the vendor. |
| 1:25-1:36 | Your mole | Local processing and the tagline. |

## Narration

Optional. One clip per scene, scenes 02 to 07; scene 01 stays silent. The number at the start of the file name assigns the clip to a scene. Load the files with **Narration and recording** on the demo page. A longer clip makes its scene longer. Files stay in the browser.

**02-company.mp3**
Nowak Law Office. Eight people, confidential files and deadlines that cannot move. No security team of its own. But it has cyberMole.

**03-tunnels.mp3**
The mole links weak spots into attack paths. Here: an open remote desktop, a taken-over computer, and at the end, the client files. It shows what could happen and why.

**04-move.mp3**
You do not have to fix everything at once. The first change takes about fifteen minutes. In this scenario it closes two of the five attack paths.

**05-mail.mp3**
An invoice arrives. A known vendor, an urgent payment, a new account number. The mole spots the lookalike domain and the attachment that only pretends to be a document. You see the concrete signs of fraud instead of guessing.

**06-plan.mp3**
What next? Grace puts payments on hold and calls the vendor on the number from the contract. The team keeps the email as evidence. Everyone gets a task that fits their role.

**07-final.mp3**
The analysis runs locally. Company data stays on its computer. cyberMole. Better your own mole gets in first.

With ElevenLabs: Text to Speech, one calm English voice for all clips, model Eleven Multilingual v2, speed 0.95, stability 50%, similarity 75%, style 0%. Download MP3 and keep the file names above.

## Recording

Landscape 1920 × 1080, 30 fps, MP4. Open the demo in full screen (**⛶**), choose **Narration and recording**, then **Hide the panel and play in 3 s**. Screen recorders on macOS do not capture browser audio by default, so record the picture and add the clips in an editor if needed.
