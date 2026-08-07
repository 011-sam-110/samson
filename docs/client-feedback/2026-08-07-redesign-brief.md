# Client feedback — 2026-08-07 (v2 redesign brief)

Raw source material. The design that came out of it is
[`docs/superpowers/specs/2026-08-07-pocko-v2-redesign-design.md`](../superpowers/specs/2026-08-07-pocko-v2-redesign-design.md).

Sketches: `sketches/` (5 pages — Overview, Transactions, Calendar, Analytics, Goals).

**Naming resolved:** the product is **Pocko**. The earlier "is Pocko a rebrand of Leeway?"
question from 2026-07-12 is closed — it is. App strings, docs and the repo all move; the
custom domain comes later.

---

## Part 1 — his written brief

> * the biggest one.. colour! right now everything is pretty dark blue and fairly formal. it
> looks like revolut because that is essentially how I wanted it to look like at the
> beginning. what im proposing now is a colour change that makes it brighter, lighter and
> more than just that, colours should be used more psychologically to make important
> information stand out, make graphs more visible, make important features like "can I spend"
> the main focus rather than just a small side feature that people ignore. I need to you
> colour strategically to make users focus on something. think of it like the chests in
> Duolingo. because its big, in the centre of the screen and there isn't anything else around
> it, your eye falls perfectly into place. we should emulate that but in order to make users
> focus on the important things.
> * next is summaries. rather than have students look for that security and still feeling on
> edge that didn't check EVERY page, there will be a custom summary at the top of every page
> to summarise the entire thing in plain English. No economic or finance jargon and no
> scrolling. It will be bold and have the main figures needed which can all be seen in more
> detail below. This means that if you go on the overview page, it'll easily summarise in a
> paragraph your spending pace, your upcoming transactions like rent or income, how much
> you've got left this week and whether you are free to splurge a bit tonight or not. That in
> a small nutshell is exactly why I ever made Pocko so having that be so elegantly simple is
> perfect.
> * Font size: a big problem even I find is just scrolling past so much information that is
> small and looks dismissible. If I as a financially literate 19 year old studying economics
> don't bother to look twice at the small print, why would anyone else? Therefore I want to
> eliminate all non useful text because all it does is devalue the actually important
> information on the page. Nothing unneeded. Stripped to its bare essentials.
> * Im getting rid of "safe daily rate", "next pay day", and "log spending" (assuming we can
> get open banking integrated). All for the sake of redundancy or simply not understanding
> its use
> * I want to also look more closely at saving because as we said before, the cost of spending
> is far more apparent than the reward of saving, and while we cant offer interest for savers,
> we should make an effort of making saving actually be tangible and feel real for users.
> Therefore I want to have a "saving pace" the same way we made a "spending pace". This means
> that people saving for goals or expensive goods can visually see the effect of their
> spending rather than just a bar that you can "add savings to". This way we are treating
> saving as a goal as opposed to 'not spending'. We need to make saving look and feel more
> rewarding rather than just an invisible reward that simply delays more spending. Im still
> tinkering with the actual way to do this but I think it's definitely something to consider
> going forward.
> * Can I Spend is going to be much bigger and the first thing under your spending pace on the
> overview page, that way you cant miss it!
> * Transactions again will have a summary at the top highlighting your spending pace again
> compared to last week or last month. There will be "recents" and "recurring" so you can see
> what transactions are normal subscriptions or rent and which are one off payments that are
> stacking up. You'll also be able to see which bank the transaction comes from and our app
> will need to categorise what kind of transaction it is, e.g Netflix = entertainment, or
> Nando's = food
> * Calendar is going to be far more interesting. Again colours is going to be the biggest way
> of doing this but it should be unbelievably clear when there are events like a birthday or
> party and when freshers week is etc.. colours will be the best way of highlighting and
> naturally grabbing peoples attention to the important stuff rather than letting them
> visually wander around clueless and eventually getting bored. Also use green for 'good'
> things like parties and birthdays and use red for .. call it 'not fun things' like rent or
> exam season. Possibly connect it to people calendars on their phones like google or apple
> calendars to sync up events.
> * Analytics: this is where the most redesigning is going to happen, not because we are
> getting rid of graphs and stuff, instead we are simply shifting the focus from spending to
> saving more! As per every page it will have a summary at the top with the biggest figures on
> the page such as 'this months vs last months spending' and percentages etc.. below will
> still be all the graphs and visual representations. Categories of spending is also a graph I
> want more bold and prominent because it's important for them to see and deserves the time of
> day. As I said, in this section savings is going to become far more important as it's the
> perfect place to showcase visual indicators of how much your saving is doing! Therefore
> there should be a spending pace bar like in the overview page, it'll show you how close you
> are to your savings rate, how many days (streak wise) you have been saving at that pace or
> over! It'll show real reward for savings which gets students into good financial habits at
> an early and vulnerable age.
> * The goals section or as I'm renaming it "saving goals" is again going to have a summary at
> the top showing how your saving and spending paces have impacted your goals. This page stays
> mostly the same as it was but with obvious colour changes and design differences to make it
> more prominent and bold. Small tips on saving will be at the bottom since it's not vital
> information for users to see first.
>
> Overall the redesign is targeting unnecessary wording, over complicated language and boring
> designs. The new version focuses on brevity, specificity, colours, psychology, font size,
> simplicity, and actual usability in a students context rather than a financial advisor's.

## Part 2 — sketch annotations not in the written brief

**Overview.** Gauge on top with a daily-rate marker on the arc, annotated *"needs a saving
rate"* and *"make the slider work"*. Can I Spend is a full-width slab directly beneath. Three
tiles below: average daily spending · what's left this week/month · total balance with next
payday inside it (so next payday survives as a sub-line, not a headline). Short commentary
block on financial security at the bottom. On Can I Spend: *"when clicked it shouldn't say
yes to everything — if it's £5 then that's different to £500."*

**Transactions.** Tabs `recents` / `recurring` ("monthly" crossed out), then a filter row
`expense` / `income` / `All`, defaulting to All + recents. *"Make it green or red to be
clear."* Cash: *"if you spent in cash you can either log manually or import screenshot."*
Note: *"once we get open banking, transactions will come from multiple banks which means we
will also need to put in that table which account it was from. Since banks don't note what
kind of expense but instead just the account transferred to, we need to use some AI or
something to recognise certain merchants as certain categories of spending such as Netflix
as 'entertainment'."*

**Calendar.** *"I want to see what formula we are using → to change the spending rate on
those days with events → needs to be explained to users in the analytics."* *"Make events far
more significant, the key is to play with colour and human psychology. green = good, red =
bad. So rather than a small dot or symbol, the colour dictates the spending or the event."*

**Analytics.** *"This section may be about the spending but it's secretly here to reward
saving! The key is to make users visually see their savings pile up and become useful."*
*"Keep most of the graphs the same but I want a visual indicator of savings at the top."*
*"Make the most important information bigger, brighter and at the top. All the ways to save
at the bottom. The loan stuff is good but needs to be in transactions and near the top."*

**Saving goals.** *"Summary of how well this week's savings have gone into your goals and how
much % you are closer."* *"Get rid of 'planned spends', it doesn't belong here."* *"Currently
everything is too easy to look past, too easy to ignore and be bored by. So rather than cram
words on a screen, we need to find a way to be brief, be precise ESPECIALLY the summaries!
They need to be the first thing people look at, without a doubt."*

## Part 3 — voice note 1 (transcript, Whisper small)

> Good afternoon gentlemen. It has been a while but we are back. I have made an extensive list
> of things that I want changed. I've had a look at the UI. Because I'm a caveman and I can't
> code like you two geniuses, it means that I had to draw it out on paper. [...] I've done it
> for every page as well as what I want to get rid of and whatever. [...] I looked into a bit
> more into the open banking stuff. I'm going to keep looking into that because there are some
> stuff that we can still do with that. The thing is, I do want to get this kind of going
> before people go back to uni. So yeah, we're going to change the UI a little bit. A big part
> of what I talk about is colors as well. So I'm going to try to find a good color scheme that
> I'm really happy with and send it over to you guys. Just so you guys have a template. I know
> it's hard for you if you're working on nothing but pure criticism. [...] Because I'd hate
> for you to spend time and effort making something just for me to say — that's not what I
> meant.

## Part 4 — voice note 2 (transcript, Whisper small)

> [...] the biggest problem now is that if let's say I'm looking at it now, it says safe to
> spend £51 today. If I go and say, okay, is it safe for me to spend £50, it'll say go for it.
> If I say is it okay for me to spend £200, it'll still say go for it. And the point is, then
> it kind of doesn't make a lot of sense. There should be a bit more specificity as opposed to
> just, oh yeah, this is fine, this is fine, this is fine. [...] Like there should be a bit of
> a stage to it in terms of, oh okay, spending £5, no problem. Spending £50, okay that still
> works. Spending £100, you're still within your range but it's getting tighter. [...]
>
> What I mean about the slider is just like it's always at the very left side on green [...]
> the point is that slider should be to where your spending rate is. So if you're doing really
> well, it should be completely green. If you're doing kind of well, it should be near
> halfway. [...] Just like actually have it do something rather than just sit there.
>
> The planned spends, the calendar stuff — it doesn't have to be involved yet. Like we don't
> have to sync that to Apple or Google yet. It's a good idea, but it's not necessary for a
> beta.
>
> What I mean about the saving rate as well, I will check the maths. [...] I just want to make
> sure that the spending rate is actually mathematically correct as well as the saving rate.
> [...] Yeah, colour scheme, I'm doing it now.

## Part 5 — his formula memo

**Saving pace.** He rejects "underspend becomes savings":

> Because not spending money isn't the same as saving it. You planned to spend £30 today. You
> only spent £10. The app says 🎉 You saved £20. But you didn't. Tomorrow you could spend that
> £20 on clothes. Nothing has actually been saved. So the reward becomes fake.
>
> Saving Pace measures how consistently you're moving towards your savings goals. Not how much
> you accidentally didn't spend. That makes it real.
>
> Monthly Income = £900. Target Saving Goal = £180 this month. Days until end of month = 30.
> Required Saving Pace = £180 / 30 = £6/day. Now suppose the user actually transfers £10 into
> their Laptop Goal today. Their Saving Pace becomes 10 ÷ 6 = 167%. Tomorrow they save nothing.
> Average pace falls slightly. Much more honest.
>
> Bands: 🟢 Saving Faster / 🟢 On Pace / 🟠 Slightly Behind / 🔴 Needs Attention.
>
> Saving Streak — this one I love. Don't define it as days you've saved. Define it as days
> you've remained on or above your target pace. Huge difference. That rewards consistency, not
> random deposits.

**Spending pace.**

> Remaining Spendable Money = Current Balance − Essential Upcoming Costs − Reserved Goal
> Savings (optional). Then Remaining Days until next income. Spending Pace = Remaining
> Spendable Money ÷ Remaining Days.
>
> Current Balance £680, Rent £300, Phone £20, Netflix £10 → Remaining £350. Next student loan
> 14 days. Spending Pace = £350 ÷ 14 = £25/day. Then compare Average Daily Spend over the
> previous 7 days. Suppose £19/day — comfortably under. Suppose £32/day — over pace.

**Can I Spend.**

> Rather than saying Safe Daily Rate (which no student says) the app should answer: Can I
> Spend? YES — you could comfortably spend around £28 tonight. Or NO — you're likely to run
> short before payday. That number should simply be Available Spending Capacity minus Today's
> projected spending.

## Part 6 — colour video (transcript, Whisper small)

Screen recording of a Google image search for "soft teal color scheme", cursor moving over
the *"8 Sage Green and Soft Teal"* and *"soft teal Color Palette"* results, ending on the
orange strip of the latter.

> Colour wise I think I'm feeling like soft teal — from what I've seen it kind of works. I
> don't know whether we need like gradients, it's not really that useful, I'd probably stay
> away from that for now. But anyway, like a bit of a softer teal than that, almost like
> something kind of like that, in between that and that. Besides that, backgrounds and stuff
> should be off white rather than just plain absolute white — that's a little in your face.
> But also not like sandy, like not too too yellow, should kind of be in between. Think like a
> really blurry beach — not bright blue and bright yellow for sand, but somewhere in the
> middle. Then it kind of sits in terms of comfort. And yeah, kind of charcoal black for text
> essentially. And then for anything that needs pointing out — like a good day on a calendar
> or an event coming up, or even a warning — brighter green than that, like an actual actual
> green, grass green. And then kind of orange red for warning stuff. [...] But those are only
> for the things that need to be pointed out.

**Caveat carried into the spec:** the video is a phone recording of a laptop screen. Its
pixel values are not usable as hex — glare and white balance corrupt them. The palette in the
spec is built from the *named* intent above and contrast-verified, then put back to him for
sign-off.

## Part 7 — Sam's priorities

> my top priorities for now is that the maths for the spending and saving paces are 100%
> accurate, that the redesign focuses on simplicity and functionality rather than cramming in
> 1000 words on every page, and to look more into how we use the open banking (but thats
> probably last for now just because its the heaviest and most influential part of it all so
> its not vital in the current stage)

Plus: Google Calendar sync is fine because it's simple; Apple can wait. Planned spends stay,
for logging upcoming events.
