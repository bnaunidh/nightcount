import { LETTERS } from "../world/letters.js";
// THE NIGHT COUNT — every readable thing in the station.
//
// House rules for this file: a manager's note sounds like a manager's note, a
// 1972 newspaper sounds like 1972, and nothing explains the story. The binder
// is written as though its author genuinely believed he was writing about
// shrinkage and liability, because he was.

export const DOCS = {
  note_n5: {
    title: "MANAGER'S NOTE",
    meta: "left on the register",
    body: `<p>Heard about Tuesday. Don't worry about the paperwork, I'll handle it.</p>
      <p>Station's last day is Sunday. You'll be paid through.</p>
      <p>Don't clock out early again.</p>
      <p class="sign">— T.</p>`,
  },
  note_n6: {
    title: "MANAGER'S NOTE",
    meta: "left on the register",
    // The first time the game says his name is on a note from his boss, in the
    // past tense.
    body: `<p>Danny —</p>
      <p>Thanks for these last few. I know it wasn't what you signed up for.</p>
      <p>Lock it, leave the keys in the drop box, don't wait for me.</p>
      <p>You <em>were</em> a good one.</p>
      <p class="sign">— T.</p>`,
  },
  jacob_file: {
    title: "PERSONNEL — 41",
    meta: "night attendant",
    body: `<p><b>JACOB</b></p>
      <p>Position: night attendant</p>
      <p>Start date: four years ago</p>
      <p>Termination date: <span class="blank">&nbsp;</span></p>
      <p class="faint">Photograph attached.</p>`,
  },


  binder: {
    title: "Night Shift Standard Practices",
    meta: "MERIDIAN FUEL &amp; PROVISIONS · FORM NS-6 · REV. 6 (03/91) · POST AT REGISTER",
    body: `
<p class="typed">This station operates unattended by management between 22:00 and 06:00.
The night attendant is the responsible employee on site.</p>
<h2>Rules</h2>
<ol>
<li>Doors are unlocked at 22:00 and remain unlocked until 06:00. The station is
open all night. It has always been open all night.</li>
<li>Exterior lighting and the roadside sign remain lit for the whole shift.</li>
<li><b>Complete every transaction you begin.</b> A sale that has been started is
finished: totalled, tendered, changed, receipted.</li>
<li>Count change back to the customer aloud. Do not hand over a fistful.</li>
<li>The drawer is not closed on an open sale.</li>
<li><b>Do not refuse service.</b> If a customer is at your counter with an item,
they are served. Disputes are for the day manager.</li>
<li>Do not follow a customer out of the building.</li>
<li>Do not accept a delivery that is not on the schedule without telephoning the
manager first.</li>
<li>The station is not to be left dark and staffed, or lit and unstaffed. If you
lose lighting, restore it or telephone the manager.</li>
<li>Record fuel meter readings at 22:00 and 06:00 in the pump log.</li>
<li>Record any incident on the incident sheet, whether or not it seems worth it.</li>
<li>The drawer will occasionally count over. Record the amount in the OVER
column. Do not remove it and do not make it up out of your own pocket.</li>
<li>Employee vehicles are parked at the rear. The vehicle in the west corner of
the lot is not to be towed, moved, or reported.</li>
<li>If you are unsure, telephone the manager. He would rather be woken.</li>
</ol>
<p class="faint">Retain this sheet for the duration of employment. Rev. 6 supersedes all
prior revisions including the handwritten additions of 11/89.</p>`,
  },

  photo_jacob: {
    title: "The photograph",
    meta: "",
    body: `<div class="photo">
      <div class="photoImg" id="photoJacob"></div>
      <p class="caption">Two of us, squinting into the sun. He is laughing at something
      off to the left that neither of us can remember.</p>
    </div>`,
  },

  receipt_tomorrow: {
    title: "Receipt",
    meta: "from a bag of shopping, on the asphalt, in the rain",
    body: `<pre class="receipt">        STATION 41
     OLD STATE ROUTE 41

  MILK 2PT            1.09
  BREAD               0.89
  BATTERIES D2        3.49
  ---------------------------
  SUBTOTAL            5.47
  TAX                 0.38
  TOTAL               5.85

  CASH                10.00
  CHANGE               4.15

  THANK YOU - CALL AGAIN
</pre><p class="stamp" id="receiptStamp"></p>`,
  },

  note_n1: {
    title: "Note on the register",
    meta: "handwritten, folded once",
    body: `<p class="hand">Right —<br><br>
Key's in the envelope. Punch clock is by the office door. Use it.<br><br>
Floor swept, shelves faced, pumps checked, readings in the log. Doors open at nine.
Nine, not ten past.<br><br>
Coffee urn is temperamental, the switch has to be held.<br><br>
Two customers a night if you're lucky. Some nights none.<br><br>
Don't go poking about out back after dark. Nothing out there but the bins.<br><br>
— the owner</p>`,
  },

  note_n2: {
    title: "Note on the register",
    meta: "handwritten",
    body: `<p class="hand">Cameras are live from tonight, district wants the last week taped.
Don't worry about the recorder, it eats a tape a night on its own.<br><br>
Bathroom key is on the hubcap by the mop sink. Check it at midnight, and if there's a mess,
it's a mess, just do it.<br><br>
Anything odd on the monitors, write it on the incident sheet. Anything.<br><br>
— G.V.</p>`,
  },

  note_n3: {
    title: "Note on the register",
    meta: "handwritten, in a hurry",
    body: `<p class="hand">Cold snap. C7 trips when it drops below freezing, it's done it for twenty years.
Panel's in the stock room. You can run four circuits, not five, don't argue with it, it's a 1974 service.<br><br>
If the whole main goes, the disconnect is on the pole out back. Torch is under the counter.<br><br>
Don't leave the store dark with you in it. I'm serious about that one.<br><br>
— G.V.</p>`,
  },

  note_n4: {
    title: "Note on the register",
    meta: "handwritten",
    body: `<p class="hand">No delivery scheduled this week. If somebody turns up with a load, you
telephone me before you sign anything. Rule 8.<br><br>
I mean it, .<br><br>
— G.V.</p>`,
  },

  note_n5: {
    title: "Note on the register",
    meta: "typed, on district letterhead, signature handwritten",
    body: `<p class="typed">Station 41 decommission is confirmed for 31 October. Closing attendant
is required to complete Form 41-C in full before the final shift ends. The form is in the
delivery received 29 October.</p>
<p class="typed">Merchandise count, fuel reconciliation and final headcount are all mandatory
fields. An incomplete 41-C will delay the release of final wages.</p>
<p class="hand"> — do the first two. Leave the third one until the last night.<br>— G.V.</p>`,
  },

  note_n6: {
    title: "Note on the register",
    meta: "handwritten, pressed hard enough to tear",
    body: `<p class="hand">Whatever comes to the counter tonight, you ring it up. Every one of them.
Count the change. Give them the paper.<br><br>
Except—</p>
<p class="faint" style="margin-top:20px">The rest of the sheet has been torn off.</p>`,
  },

  pumplog: {
    title: "Pump Meter Log — Station 41",
    meta: "spiral bound · one page per night · initial each entry",
    body: `
<table>
<tr><th>DATE</th><th>22:00</th><th>06:00</th><th>SOLD (GAL)</th><th>INIT</th></tr>
<tr><td>10-18-97</td><td>884,112</td><td>884,119</td><td>7</td><td>G.V.</td></tr>
<tr><td>10-19-97</td><td>884,119</td><td>884,131</td><td>12</td><td>G.V.</td></tr>
<tr><td>10-20-97</td><td>884,131</td><td>884,131</td><td>0</td><td>G.V.</td></tr>
<tr><td>10-21-97</td><td>884,131</td><td>884,140</td><td>9</td><td>G.V.</td></tr>
<tr><td class="faint">10-24-97</td><td class="faint">884,140</td><td class="faint">884,153</td><td class="faint">13</td><td class="faint">W.A.</td></tr>
<tr><td><b>10-23-97</b></td><td class="field"></td><td class="field"></td><td class="field"></td><td class="field"></td></tr>
</table>
<p class="faint">Older pages are underneath, going back years. The handwriting changes every
few pages and then, for a long stretch in 1988 and 1989, it doesn't.</p>`,
  },

  pumplog_1989: {
    title: "Pump Meter Log — older pages",
    meta: "1989 · the same book",
    body: `
<table>
<tr><th>DATE</th><th>22:00</th><th>06:00</th><th>SOLD</th><th>INIT</th></tr>
<tr><td>11-19-89</td><td>402,880</td><td>402,946</td><td>66</td><td>D.A.</td></tr>
<tr><td>11-20-89</td><td>402,946</td><td>403,001</td><td>55</td><td>D.A.</td></tr>
<tr><td>11-21-89</td><td>403,001</td><td>403,060</td><td>59</td><td>D.A.</td></tr>
<tr><td>11-22-89</td><td>403,060</td><td>—</td><td>—</td><td>D.A.</td></tr>
</table>
<p>The last row's 06:00 column is empty. Underneath, in the margin, in handwriting you
have known your whole life:</p>
<p class="hand">he's still out there. G says just ring it up but I'm not selling
cigarettes to that</p>
<p class="faint">The sentence stops. The pen went through the paper.</p>`,
  },

  danny_file: {
    title: "Employee File — ALCOTT, DANIEL R.",
    meta: "MERIDIAN PERSONNEL · STATION 41 · CONFIDENTIAL",
    body: `
<table>
<tr><th>Hired</th><td>06-14-88</td><th>Position</th><td>Night Attendant</td></tr>
<tr><th>D.O.B.</th><td>02-09-68</td><th>Rate</th><td>$4.85/hr</td></tr>
<tr><th>Emergency contact</th><td colspan="3">ALCOTT, M. (mother) — Coldbrook 555-0148</td></tr>
<tr><th>Status</th><td colspan="3"><b>SEPARATED 11-22-89 — ABANDONED POST</b></td></tr>
</table>
<h2>Manager's remarks</h2>
<p class="typed">Good worker. Punctual. Counted the drawer twice every night without being
asked. Reported everything on the incident sheet, including things I told him not to bother
with.</p>
<p class="typed">On the night of 11-22-89 he telephoned me at 03:52 regarding a customer. I
advised him to complete the sale. He did not complete the sale. At 04:07 the recorder shows
the store empty.</p>
<p class="typed">His vehicle remains on the property. I have declined to have it removed.</p>
<p class="typed faint">Sheriff's office notified 11-23-89. Case 89-0441. No further action
this office.</p>
<div class="stamp">DO NOT DESTROY — PENDING</div>`,
  },

  memo_1979: {
    title: "District Memorandum",
    meta: "MERIDIAN FUEL &amp; PROVISIONS · DISTRICT 4 · 08-20-1979 · ALL STATIONS",
    body: `
<p class="typed">Effective immediately, overnight staffing at all District 4 stations is
continuous. No station is to be left <u>dark and staffed</u> or <u>lit and unstaffed</u>.</p>
<p class="typed">Where a station cannot be staffed for a full overnight period, the roadside
sign and canopy lighting are to be extinguished for the entirety of that period. Partial
lighting is not acceptable.</p>
<p class="typed">Attendants are reminded that transactions initiated during the overnight
period are to be completed without exception. Refusal of service has been a factor in three
separate incidents this year and district will not carry the liability.</p>
<p class="typed faint">This memorandum supersedes the guidance issued 04-1974 and is not to be
posted publicly.</p>`,
  },

  clipping_1972: {
    title: "The Harney County Register",
    meta: "MARCH 16, 1972 · PAGE 3",
    body: `
<h2>EIGHT DEAD IN ROUTE 41 TANKER FIRE</h2>
<p class="typed">Eight persons are confirmed dead following the overturning of a fuel tanker
on the Mile 41 switchback of Old State Route 41 early Tuesday morning.</p>
<p class="typed">The tanker, operated by Meridian Fuel &amp; Provisions of Bend, left the
roadway at approximately 3:50 a.m. and ruptured. Fire crossed the highway and burned for
forty minutes before county units arrived from Coldbrook.</p>
<p class="typed">The dead include the driver, A. Sallis, 44; four members of a county road
maintenance crew whose truck was parked on the shoulder; and Mr. and Mrs. R. Halloran of
Burns, who were travelling north.</p>
<p class="typed">An eighth body, that of a man on foot, has not been identified. Sheriff
Deeming said the man carried no papers and that no vehicle has been found abandoned in the
vicinity.</p>
<p class="typed faint">A representative of Meridian Fuel said the company would cooperate
fully with the county's inquiry.</p>`,
  },

  missing_1989: {
    title: "MISSING",
    meta: "photocopy, sun-bleached, taken down and put back up many times",
    body: `
<h2 class="center">DANIEL ALCOTT — 21</h2>
<p class="center typed">Last seen at his place of work, Meridian Station 41, Old State Route 41,
in the early morning of November 22, 1989.</p>
<p class="center typed">6'0", brown hair, brown eyes. Wearing a green work jacket.<br>
His car was left at the station with the keys in it.</p>
<p class="center typed"><b>ANY INFORMATION — HARNEY CO. SHERIFF 555-0100</b></p>
<p class="center hand">Please. Anything at all. — M. Alcott</p>`,
  },

  countsheet: {
    title: "Nightly Count Sheet",
    meta: "STATION 41 · one line per night · OVER column mandatory",
    body: `
<table>
<tr><th>NIGHT</th><th>FLOAT</th><th>TAKINGS</th><th>DRAWER</th><th>OVER</th><th>INIT</th></tr>
<tr><td>10-18</td><td>120.00</td><td>14.50</td><td>136.75</td><td><b>2.25</b></td><td>G.V.</td></tr>
<tr><td>10-19</td><td>120.00</td><td>22.10</td><td>145.85</td><td><b>3.75</b></td><td>G.V.</td></tr>
<tr><td>10-20</td><td>120.00</td><td>0.00</td><td>120.00</td><td><b>0.00</b></td><td>G.V.</td></tr>
<tr><td>10-21</td><td>120.00</td><td>9.25</td><td>130.75</td><td><b>1.50</b></td><td>G.V.</td></tr>
</table>
<p class="faint">The OVER column is pre-printed on every sheet, going back to 1974. It has its
own box on the form. Somebody designed this.</p>`,
  },

  manifest: {
    title: "Delivery Manifest",
    meta: "MERIDIAN DISTRIBUTION · UNSCHEDULED · 10-29-97 · DRIVER COPY",
    body: `
<table>
<tr><th>LINE</th><th>DESCRIPTION</th><th>QTY</th><th>UPC</th></tr>
<tr><td>1</td><td>COFFEE, GROUND, 39 OZ</td><td>4</td><td>0 41290 00311 7</td></tr>
<tr><td>2</td><td>CUPS, PAPER, 12 OZ, SLV/50</td><td>6</td><td>0 41290 00822 4</td></tr>
<tr><td>3</td><td>MOTOR OIL 10W-30 QT</td><td>12</td><td>0 41290 01190 2</td></tr>
<tr><td>4</td><td>CIGARETTES, ASSORTED CARTON</td><td>2</td><td>0 41290 02255 8</td></tr>
<tr><td>5</td><td>PAPER, RECEIPT, ROLL</td><td>10</td><td>0 41290 00905 1</td></tr>
<tr><td>6</td><td class="typed"><b>41-C / FINAL COUNT</b></td><td>1</td><td class="faint">— no code —</td></tr>
</table>
<p class="faint">Line 6 has no barcode, no price, and no weight. The driver has already
signed the top copy. He is waiting for yours.</p>`,
  },

  floorplan: {
    title: "Station 41 — Floor Plan",
    meta: "taped inside the office door · drawn 1974 · amended in pen",
    body: `
<pre style="font-size:11px;line-height:1.25">
   +----------------------------------------------+
   |  OFFICE     |     STOCK        |  RESTROOM   |
   |             |                  |             |
   +---[  ]------+------[  ]--------+----[  ]-----+
   |                                              |
   |    COOLER RUN ============================   |
   |                                              |
   |   [aisle 1]   [aisle 2]   [aisle 3]          |
   |                                              |
   |  ====COUNTER====                     COFFEE  |
   |                                              |
   +==========GLAZING=============[ENTRY]=========+
</pre>
<p class="faint">Three aisles. One cooler run. Three doors on the back wall.</p>`,
  },

  form41c: {
    title: "Form 41-C — Station Decommission: Final Count",
    meta: "MERIDIAN FUEL &amp; PROVISIONS · FORM 41-C (REV. 1972) · ONE COPY TO DISTRICT",
    body: null,   // built live by DocSystem (it is fillable)
  },

  smallroom: {
    title: "Count Sheets",
    meta: "stacked on the floor of a room that is not on the plan",
    body: `
<p class="typed">Every nightly count sheet Station 41 has ever filed. Fifty-eight bundles,
tied with string, in order.</p>
<p class="typed">The OVER column is filled in on every single one. Some nights it is a
quarter. Some nights it is eleven dollars.</p>
<p class="typed">The last bundle isn't tied yet. The top sheet is tonight's, in your
handwriting, and you have not filled it in.</p>`,
  },
};

/** The manager's note for a given night. */
export const NOTE_FOR = { 1: "note_n1", 2: "note_n2", 3: "note_n3", 4: "note_n4", 5: "note_n5", 6: "note_n6" };

for (const letter of LETTERS) DOCS[letter.key] = {title:letter.title,meta:letter.meta,body:letter.body.map(p => `<p>${p}</p>`).join("")};
