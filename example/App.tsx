import { useMemo, useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  BottomSheetProvider,
  HoldToConfirmButton,
  ModalBottomSheet,
  SheetDock,
  SheetFooter,
  SheetHandle,
  SheetHeader,
  programmatic,
  useSheetStack,
  type KeyboardBehavior,
} from 'bottom-sheet-native';

type DemoId =
  | 'confirm'
  | 'confirm-native'
  | 'react'
  | 'cards'
  | 'filter'
  | 'sort'
  | 'folders'
  | 'action'
  | 'scan'
  | 'post'
  | 'color'
  | 'form'
  | 'offer'
  | 'paywall'
  | 'create-folder'
  | 'folder-action'
  | 'edit-folder'
  | 'needed-action'
  | 'attach'
  | 'poll'
  | 'reactions'
  | 'blocked'
  | 'profile-design';

type CatalogItem = {
  id: DemoId;
  title: string;
  blurb: string;
  note?: string;
  warn?: string;
};

type CatalogSection = { heading: string; items: CatalogItem[] };

const SECTIONS: CatalogSection[] = [
  {
    heading: 'App-wide',
    items: [
      {
        id: 'confirm',
        title: 'Confirm sheet (hold-to-confirm)',
        blurb:
          'The destructive confirm used across the app: Settings → Delete account, remove profile photo/section, delete a folder or item, delete a community post.',
      },
      {
        id: 'confirm-native',
        title: 'Confirm sheet – native engine port',
        blurb:
          'Migration probe: the same confirm flow on the native Swift/Kotlin engine (native detents, scrim, drag-to-dismiss). Chrome is a replica of the video.',
      },
      {
        id: 'paywall',
        title: 'Pro upgrade paywall',
        blurb:
          'Opened everywhere a free user hits a Pro feature: Settings upgrade row, brand colour / app icon rows, gated sales history, scan limits.',
        note: 'Pro users normally never see it — Settings shows Manage subscription instead.',
      },
    ],
  },
  {
    heading: 'Community',
    items: [
      {
        id: 'react',
        title: 'Emoji reaction sheet',
        blurb:
          'The “+” add-reaction button on community posts. Opens collapsed to a quick-react row, drags up to the full picker.',
      },
    ],
  },
  {
    heading: 'Add cards & scan',
    items: [
      {
        id: 'cards',
        title: 'Add cards – native engine port',
        blurb:
          'Search and tap every card you want, then continue. Keyboard grows the content detent; the list negotiates scroll with the sheet.',
      },
    ],
  },
  {
    heading: 'Collection tab',
    items: [
      {
        id: 'filter',
        title: 'Library filter sheet',
        blurb: 'Collection tab → Filters button in the search toolbar. Status page with Active / Archived.',
      },
      {
        id: 'sort',
        title: 'Library sort sheet',
        blurb: 'Collection tab → Sort button in the search toolbar.',
        warn: 'Picking an option really changes your library sort.',
      },
      {
        id: 'folders',
        title: 'Card action sheet (folders)',
        blurb: 'Long-press menu → Add to folder. Toggle multiple folders, Done to finish.',
      },
      {
        id: 'action',
        title: 'Card action sheet (long-press menu)',
        blurb: 'Select / Add to folder / Add tag / Archive / Delete. Tag page is a nested stack.',
      },
      {
        id: 'scan',
        title: 'Scan results sheet (persistent)',
        blurb: 'Always-visible peek/expand panel. Never closes — drag cannot reach the 0 detent.',
      },
      {
        id: 'post',
        title: 'Post options menu',
        blurb: 'Reactions / Report / Block. Compact action list, content-sized.',
      },
    ],
  },
  {
    heading: 'Folder / listing',
    items: [
      {
        id: 'color',
        title: 'New folder / custom colour',
        blurb: 'Name + palette, then a nested custom colour page with a back affordance.',
      },
      {
        id: 'form',
        title: 'Wanted card details',
        blurb: 'Notes, source link, grade, exact-card toggle. Keyboard inset on the content detent.',
      },
      {
        id: 'offer',
        title: 'Make an offer',
        blurb: 'Numeric keyboard + content-sized sheet with a lime send CTA.',
      },
    ],
  },
  {
    heading: 'Folders',
    items: [
      {
        id: 'create-folder',
        title: 'New folder sheet',
        blurb: 'Collection tab, Folders segment → “+” button. Name, colour palette, custom colour page.',
        warn: 'Creating really makes a folder.',
      },
      {
        id: 'folder-action',
        title: 'Folder action sheet (long-press)',
        blurb: 'Collection tab, Folders segment → long-press a folder card: Edit folder / Delete folder.',
        warn: 'The delete page really deletes the folder (hold-to-confirm).',
      },
      {
        id: 'edit-folder',
        title: 'Edit folder sheet',
        blurb: 'Folder detail → pencil. Rename, recolour, notes, Featured cards.',
        warn: 'Save really updates the folder.',
      },
      {
        id: 'needed-action',
        title: 'Needed-card action sheet',
        blurb: 'Folder detail → long-press a “Still need” tile: Wanted details, Select, Add to folder, Remove.',
      },
    ],
  },
  {
    heading: 'Community compose',
    items: [
      {
        id: 'attach',
        title: 'Compose post — Attach',
        blurb: 'Photos, video, card, folder, checklist, poll, emoji slider. Done + back.',
      },
      {
        id: 'poll',
        title: 'Poll composer',
        blurb: 'Yes / No choices, add a choice, poll length 1h–1w.',
      },
      {
        id: 'reactions',
        title: 'Reactions list',
        blurb: 'Post options → Reactions. Empty/loading state with Done.',
      },
      {
        id: 'blocked',
        title: 'Blocked collectors',
        blurb: 'Settings → Blocked collectors. Empty state when none.',
      },
    ],
  },
  {
    heading: 'Profile editing',
    items: [
      {
        id: 'profile-design',
        title: 'Profile Design sheet',
        blurb: 'Account → Edit profile → Design. Font + text colour, live-preview backdrop.',
        warn: 'Save really updates your profile design.',
      },
    ],
  },
];

const CARDS = [
  { title: '#30 Charles Leclerc & Lewis Hamilton', sub: '2026 Turbo Attax 2026 · FI Dynamic Duos' },
  { title: '#24 Charles Leclerc & Lewis Hamilton', sub: '2025 Turbo Attax 2025 · Scuderia Ferrari Hp' },
  { title: 'Charles Leclerc / Lewis Hamilton', sub: '2025 Eccellenza 2025 · Reliquia La Squadra B…' },
  { title: '#165 Charles Leclerc / Lewis Hamilton', sub: '2025 Logofractor 2025 · FI Duo' },
  { title: 'Charles Leclerc / Lewis Hamilton', sub: '2025 Eccellenza 2025 · La Squadra' },
  { title: '#165 Charles Leclerc / Lewis Hamilton', sub: '2025 Sapphire 2025 · FI Duo Cards' },
  { title: '#165 Charles Leclerc / Lewis Hamilton', sub: '2025 Chrome 2025 · FI Duo Cards' },
  { title: 'Frédéric Vasseur / Charles Leclerc / Lewis Ha…', sub: '2026 Lights Out 2026 · Powertrain' },
  { title: '#8 GB Drivers (Russell/Hamilton/Norris)', sub: '2022 Topps Now 2022 · Formula 1' },
  { title: '#P10 George Russell & Lewis Hamilton', sub: '2022 Topps Now 2022 · Road To 2022' },
];

const FOLDERS: { name: string; color: string }[] = [
  { name: 'Test', color: '#111111' },
  { name: 'eee', color: '#ef4444' },
  { name: 'Want', color: '#3b82f6' },
  { name: 'Green Helmets', color: '#22c55e' },
  { name: 'Perfect 10s', color: '#ef4444' },
  { name: 'Sss', color: '#3b82f6' },
  { name: '1/1s', color: '#ca8a04' },
  { name: 'Gloves', color: '#3b82f6' },
  { name: 'Piastri', color: '#3b82f6' },
];

const EMOJI_CATEGORIES = ['Smileys', 'People', 'Nature', 'Food', 'Travel'] as const;

const EMOJI_LIB: { glyph: string; name: string; category: (typeof EMOJI_CATEGORIES)[number] }[] = [
  { glyph: '😀', name: 'grinning', category: 'Smileys' },
  { glyph: '😃', name: 'smiley', category: 'Smileys' },
  { glyph: '😄', name: 'smile', category: 'Smileys' },
  { glyph: '😁', name: 'grin', category: 'Smileys' },
  { glyph: '😆', name: 'laughing', category: 'Smileys' },
  { glyph: '😅', name: 'sweat smile', category: 'Smileys' },
  { glyph: '😂', name: 'joy tears', category: 'Smileys' },
  { glyph: '🤣', name: 'rofl', category: 'Smileys' },
  { glyph: '😊', name: 'blush', category: 'Smileys' },
  { glyph: '😇', name: 'innocent', category: 'Smileys' },
  { glyph: '🙂', name: 'slight smile', category: 'Smileys' },
  { glyph: '😉', name: 'wink', category: 'Smileys' },
  { glyph: '😍', name: 'heart eyes', category: 'Smileys' },
  { glyph: '🥰', name: 'smiling hearts', category: 'Smileys' },
  { glyph: '😘', name: 'kiss', category: 'Smileys' },
  { glyph: '😋', name: 'yum', category: 'Smileys' },
  { glyph: '😜', name: 'stuck out tongue', category: 'Smileys' },
  { glyph: '🤪', name: 'zany', category: 'Smileys' },
  { glyph: '😎', name: 'sunglasses', category: 'Smileys' },
  { glyph: '🤩', name: 'star struck', category: 'Smileys' },
  { glyph: '🥳', name: 'partying', category: 'Smileys' },
  { glyph: '😏', name: 'smirk', category: 'Smileys' },
  { glyph: '😒', name: 'unamused', category: 'Smileys' },
  { glyph: '😞', name: 'disappointed', category: 'Smileys' },
  { glyph: '😔', name: 'pensive', category: 'Smileys' },
  { glyph: '😢', name: 'cry', category: 'Smileys' },
  { glyph: '😭', name: 'sob', category: 'Smileys' },
  { glyph: '😤', name: 'triumph', category: 'Smileys' },
  { glyph: '😡', name: 'rage', category: 'Smileys' },
  { glyph: '🤯', name: 'exploding head', category: 'Smileys' },
  { glyph: '😴', name: 'sleeping', category: 'Smileys' },
  { glyph: '🤔', name: 'thinking', category: 'Smileys' },
  { glyph: '🤗', name: 'hugs', category: 'Smileys' },
  { glyph: '🤫', name: 'shush', category: 'Smileys' },
  { glyph: '🤭', name: 'hand over mouth', category: 'Smileys' },
  { glyph: '😐', name: 'neutral', category: 'Smileys' },
  { glyph: '😬', name: 'grimace', category: 'Smileys' },
  { glyph: '🙄', name: 'eye roll', category: 'Smileys' },
  { glyph: '👍', name: 'thumbs up', category: 'People' },
  { glyph: '👎', name: 'thumbs down', category: 'People' },
  { glyph: '👏', name: 'clap', category: 'People' },
  { glyph: '🙌', name: 'raised hands', category: 'People' },
  { glyph: '🤝', name: 'handshake', category: 'People' },
  { glyph: '💪', name: 'muscle', category: 'People' },
  { glyph: '✌️', name: 'victory', category: 'People' },
  { glyph: '🤞', name: 'crossed fingers', category: 'People' },
  { glyph: '👋', name: 'wave', category: 'People' },
  { glyph: '🫶', name: 'heart hands', category: 'People' },
  { glyph: '🙏', name: 'pray', category: 'People' },
  { glyph: '👀', name: 'eyes', category: 'People' },
  { glyph: '🐶', name: 'dog', category: 'Nature' },
  { glyph: '🐱', name: 'cat', category: 'Nature' },
  { glyph: '🦊', name: 'fox', category: 'Nature' },
  { glyph: '🦁', name: 'lion', category: 'Nature' },
  { glyph: '🐼', name: 'panda', category: 'Nature' },
  { glyph: '🌸', name: 'blossom', category: 'Nature' },
  { glyph: '🌞', name: 'sun', category: 'Nature' },
  { glyph: '⭐', name: 'star', category: 'Nature' },
  { glyph: '🔥', name: 'fire', category: 'Nature' },
  { glyph: '💯', name: 'hundred', category: 'Smileys' },
  { glyph: '❤️', name: 'heart', category: 'Smileys' },
  { glyph: '🍕', name: 'pizza', category: 'Food' },
  { glyph: '🍔', name: 'burger', category: 'Food' },
  { glyph: '🍟', name: 'fries', category: 'Food' },
  { glyph: '🌮', name: 'taco', category: 'Food' },
  { glyph: '🍣', name: 'sushi', category: 'Food' },
  { glyph: '🍩', name: 'doughnut', category: 'Food' },
  { glyph: '🍪', name: 'cookie', category: 'Food' },
  { glyph: '☕', name: 'coffee', category: 'Food' },
  { glyph: '🍺', name: 'beer', category: 'Food' },
  { glyph: '🍷', name: 'wine', category: 'Food' },
  { glyph: '🏎️', name: 'race car', category: 'Travel' },
  { glyph: '🏁', name: 'chequered flag', category: 'Travel' },
  { glyph: '🥇', name: 'gold medal', category: 'Travel' },
  { glyph: '✈️', name: 'airplane', category: 'Travel' },
  { glyph: '🚀', name: 'rocket', category: 'Travel' },
  { glyph: '🚗', name: 'car', category: 'Travel' },
  { glyph: '🏆', name: 'trophy', category: 'Travel' },
];

const QUICK_REACT = ['👍', '🔥', '😍', '💯', '😂'];

const SORTS = ['Recently added', 'Set / number', 'Player', 'Value'];

export default function App() {
  return (
    <BottomSheetProvider>
      <Catalog />
    </BottomSheetProvider>
  );
}

function Catalog() {
  const [open, setOpen] = useState<DemoId | null>(null);
  const [inlineIndex, setInlineIndex] = useState(0);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.catalog} contentInsetAdjustmentBehavior="automatic">
        <View style={styles.topBar}>
          <Text style={styles.backChevron}>‹</Text>
          <Text style={styles.brand}>cardtrace</Text>
          <View style={styles.gear}>
            <Text style={styles.gearGlyph}>⚙︎</Text>
          </View>
        </View>
        <Text style={styles.intro}>
          Flows marked “Pro” branch by tier — flip the Pro toggle in Settings → Developer to compare both
          sides.
        </Text>

        {SECTIONS.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.heading}</Text>
            {section.items.map((item) => (
              <View key={item.id} style={styles.card}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardBlurb}>{item.blurb}</Text>
                {item.note ? <Text style={styles.cardNote}>{item.note}</Text> : null}
                {item.warn ? <Text style={styles.cardWarn}>⚠ {item.warn}</Text> : null}
                <Pressable onPress={() => setOpen(item.id)} style={styles.openBtn}>
                  <Text style={styles.openLabel}>Open</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Inline sheet (programmatic mid detent)</Text>
          <Text style={styles.cardBlurb}>
            Non-scrim peek inside the screen. The mid detent is programmatic-only — drag skips it.
          </Text>
          <Pressable
            onPress={() => setInlineIndex((current) => (current === 0 ? 1 : 0))}
            style={styles.openBtn}
          >
            <Text style={styles.openLabel}>Toggle inline</Text>
          </Pressable>
        </View>
        <View style={{ height: 160 }} />
      </ScrollView>

      <ConfirmSheet open={open === 'confirm' || open === 'confirm-native'} onClose={() => setOpen(null)} />
      <ReactSheet open={open === 'react'} onClose={() => setOpen(null)} />
      <CardsSheet open={open === 'cards'} onClose={() => setOpen(null)} />
      <FilterSheet open={open === 'filter'} onClose={() => setOpen(null)} />
      <SortSheet open={open === 'sort'} onClose={() => setOpen(null)} />
      <FoldersSheet open={open === 'folders'} onClose={() => setOpen(null)} />
      <ActionSheet open={open === 'action'} onClose={() => setOpen(null)} />
      <ScanSheet open={open === 'scan'} onClose={() => setOpen(null)} />
      <PostSheet open={open === 'post'} onClose={() => setOpen(null)} />
      <ColorSheet open={open === 'color'} onClose={() => setOpen(null)} />
      <FormSheet open={open === 'form'} onClose={() => setOpen(null)} />
      <OfferSheet open={open === 'offer'} onClose={() => setOpen(null)} />
      <PaywallSheet open={open === 'paywall'} onClose={() => setOpen(null)} />
      <CreateFolderSheet open={open === 'create-folder'} onClose={() => setOpen(null)} />
      <FolderActionSheet open={open === 'folder-action'} onClose={() => setOpen(null)} />
      <EditFolderSheet open={open === 'edit-folder'} onClose={() => setOpen(null)} />
      <NeededActionSheet open={open === 'needed-action'} onClose={() => setOpen(null)} />
      <AttachSheet open={open === 'attach'} onClose={() => setOpen(null)} />
      <PollSheet open={open === 'poll'} onClose={() => setOpen(null)} />
      <ReactionsSheet open={open === 'reactions'} onClose={() => setOpen(null)} />
      <BlockedSheet open={open === 'blocked'} onClose={() => setOpen(null)} />
      <ProfileDesignSheet open={open === 'profile-design'} onClose={() => setOpen(null)} />

      <ModalBottomSheet
        detents={[0, 132, programmatic(260)]}
        index={inlineIndex}
        onIndexChange={setInlineIndex}
        scrimColor="#00000000"
        sheetBackgroundColor="#111"
        sheetCornerRadius={22}
      >
        <SheetHandle />
        <View style={{ paddingHorizontal: 16, paddingBottom: 20 }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Inline peek</Text>
          <Text style={{ color: '#a1a1aa', marginTop: 6, lineHeight: 20 }}>
            Mid detent is programmatic-only — drag skips it.
          </Text>
        </View>
      </ModalBottomSheet>
    </View>
  );
}

function SheetScaffold({
  open,
  onClose,
  title,
  detents = [0, 'content'],
  indexOverride,
  onIndexChange,
  keyboardBehavior = 'none',
  dismissible = true,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  detents?: (number | 'content' | `${number}%`)[];
  indexOverride?: number;
  onIndexChange?: (index: number) => void;
  keyboardBehavior?: KeyboardBehavior;
  dismissible?: boolean;
  children: ReactNode;
}) {
  const index = indexOverride ?? (open ? 1 : 0);
  return (
    <ModalBottomSheet
      contentHeightAnimation="spring"
      detents={detents}
      dismissible={dismissible}
      index={open ? index : 0}
      keyboardBehavior={keyboardBehavior}
      onIndexChange={(next) => {
        onIndexChange?.(next);
        if (next === 0) onClose();
      }}
      scrimColor="rgba(0,0,0,0.45)"
      sheetBackgroundColor="#fff"
      sheetCornerRadius={28}
    >
      <SheetHandle />
      <SheetHeader onClose={onClose} title={title} />
      {children}
    </ModalBottomSheet>
  );
}

function ConfirmSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <SheetScaffold onClose={onClose} open={open} title="Debug confirm">
      <View style={styles.sheetBody}>
        <Text style={styles.bodyCopy}>Hold-to-confirm demo. Confirming does nothing.</Text>
        <HoldToConfirmButton label="Hold to confirm" onConfirm={onClose} />
      </View>
    </SheetScaffold>
  );
}

function ReactSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [index, setIndex] = useState(1);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<(typeof EMOJI_CATEGORIES)[number]>('Smileys');
  const live = open ? Math.max(index, 1) : 0;
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return EMOJI_LIB.filter((item) => {
      if (needle) return item.name.includes(needle) || item.glyph === needle;
      return item.category === category;
    });
  }, [category, query]);

  return (
    <SheetScaffold
      detents={[0, 176, '92%']}
      indexOverride={live}
      keyboardBehavior="stick"
      onClose={onClose}
      onIndexChange={setIndex}
      open={open}
      title="React"
    >
      <View style={styles.emojiRow}>
        {QUICK_REACT.map((emoji) => (
          <Pressable key={emoji} onPress={onClose} style={styles.emojiChip}>
            <Text style={styles.emoji}>{emoji}</Text>
          </Pressable>
        ))}
      </View>
      {live >= 2 ? (
        <>
          <View style={styles.searchBox}>
            <TextInput
              autoCorrect={false}
              onChangeText={setQuery}
              onFocus={() => setIndex(2)}
              placeholder="Search emoji..."
              placeholderTextColor="#a1a1aa"
              style={styles.searchInput}
              value={query}
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiTabs}>
            {EMOJI_CATEGORIES.map((item) => (
              <Pressable key={item} onPress={() => setCategory(item)} style={styles.emojiTab}>
                <Text style={[styles.emojiTabLabel, category === item && !query && styles.emojiTabOn]}>
                  {item}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.emojiGrid}>
            {results.map((item) => (
              <Pressable key={item.glyph + item.name} onPress={onClose} style={styles.emojiGridHit}>
                <Text style={styles.emojiGridItem}>{item.glyph}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <Text style={styles.hint}>Swipe up to see more</Text>
      )}
    </SheetScaffold>
  );
}

function CardsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('hamilton');
  const [selected, setSelected] = useState<string>(CARDS[0].title);
  const results = useMemo(
    () =>
      CARDS.filter((item) =>
        `${item.title} ${item.sub}`.toLowerCase().includes(query.trim().toLowerCase())
      ),
    [query]
  );

  return (
    <SheetScaffold
      keyboardBehavior="stick"
      onClose={onClose}
      open={open}
      title="Add cards"
    >
      <Text style={styles.subhead}>Search and tap every card you want, then continue.</Text>
      <View style={{ maxHeight: 420 }}>
        <ScrollView keyboardShouldPersistTaps="handled">
          {results.map((item) => {
            const active = item.title === selected && item.sub.includes('Sapphire');
            const on = item.title === selected;
            return (
              <Pressable
                key={item.title + item.sub}
                onPress={() => setSelected(item.title)}
                style={styles.cardRow}
              >
                <View style={styles.thumb} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={styles.cardRowTitle}>
                    {item.title}
                  </Text>
                  <Text numberOfLines={1} style={styles.cardRowSub}>
                    {item.sub}
                  </Text>
                </View>
                <Text style={[styles.plus, on && styles.plusOn]}>{active || on ? '✓' : '+'}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <SheetDock>
        <View style={styles.searchBox}>
          <TextInput
            onChangeText={setQuery}
            placeholder="Search cards"
            style={styles.searchInput}
            value={query}
          />
        </View>
        <View style={styles.sheetPad}>
          <Pressable onPress={onClose} style={styles.cta}>
            <Text style={styles.ctaLabel}>Continue (1 card)</Text>
          </Pressable>
        </View>
      </SheetDock>
    </SheetScaffold>
  );
}

function FilterSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [status, setStatus] = useState<'active' | 'archived'>('active');
  return (
    <SheetScaffold onClose={onClose} open={open} title="Status">
      {(['active', 'archived'] as const).map((value) => (
        <Pressable key={value} onPress={() => setStatus(value)} style={styles.plainRow}>
          <Text style={styles.plainRowTitle}>{value === 'active' ? 'Active' : 'Archived'}</Text>
          <View style={[styles.radio, status === value && styles.radioOn]} />
        </Pressable>
      ))}
      <SheetFooter onBack={onClose}>
        <Pressable onPress={onClose} style={styles.cta}>
          <Text style={styles.ctaLabel}>Show 214 cards</Text>
        </Pressable>
      </SheetFooter>
      <View style={{ height: 18 }} />
    </SheetScaffold>
  );
}

function SortSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [sort, setSort] = useState(SORTS[0]);
  return (
    <SheetScaffold onClose={onClose} open={open} title="Sort">
      {SORTS.map((value) => (
        <Pressable key={value} onPress={() => setSort(value)} style={styles.plainRow}>
          <Text style={styles.plainRowTitle}>{value}</Text>
          <View style={[styles.radio, sort === value && styles.radioOn]} />
        </Pressable>
      ))}
      <View style={{ height: 18 }} />
    </SheetScaffold>
  );
}

function FoldersSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [picked, setPicked] = useState<string[]>(['Gloves']);
  return (
    <SheetScaffold onClose={onClose} open={open} title="Folders">
      <Text style={styles.subhead}>
        Choose every folder this variation belongs to. Base and each parallel are separate.
      </Text>
      {FOLDERS.map((folder) => {
        const on = picked.includes(folder.name);
        return (
          <Pressable
            key={folder.name}
            onPress={() =>
              setPicked((current) =>
                on ? current.filter((item) => item !== folder.name) : [...current, folder.name]
              )
            }
            style={styles.folderRow}
          >
            <View style={[styles.swatchDot, { backgroundColor: folder.color }]} />
            <Text style={styles.plainRowTitle}>{folder.name}</Text>
            <View style={[styles.check, on && styles.checkOn]}>{on ? <Text style={styles.checkMark}>✓</Text> : null}</View>
          </Pressable>
        );
      })}
      <View style={styles.folderFooter}>
        <Pressable onPress={onClose} style={[styles.cta, { flex: 1 }]}>
          <Text style={styles.ctaLabel}>✓  Done</Text>
        </Pressable>
        <Pressable style={styles.plusBtn}>
          <Text style={styles.plusBtnGlyph}>+</Text>
        </Pressable>
      </View>
    </SheetScaffold>
  );
}

function ColorSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const stack = useSheetStack<'list' | 'custom'>('list');
  return (
    <SheetScaffold
      onClose={() => {
        stack.reset();
        onClose();
      }}
      open={open}
      title={stack.page === 'list' ? 'New folder' : 'Custom colour'}
    >
      {stack.page === 'list' ? (
        <View style={styles.sheetBody}>
          <Text style={styles.bodyCopy}>Name, colour palette, then a nested custom colour page.</Text>
          <Pressable onPress={() => stack.push('custom')} style={styles.secondary}>
            <Text style={styles.secondaryLabel}>Pick custom colour</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.sheetBody}>
          <Text style={styles.bodyCopy}>Drag to pick any colour. Native sheet stays mounted.</Text>
          <View style={styles.colorField}>
            <View style={styles.colorPreview} />
            <Text style={styles.hex}>#208AEF</Text>
          </View>
          <View style={styles.gradient} />
          <View style={styles.hue} />
          <SheetFooter onBack={stack.pop}>
            <Pressable onPress={onClose} style={styles.cta}>
              <Text style={styles.ctaLabel}>Select colour</Text>
            </Pressable>
          </SheetFooter>
        </View>
      )}
    </SheetScaffold>
  );
}

function FormSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [exact, setExact] = useState(false);
  return (
    <SheetScaffold
      keyboardBehavior="extend"
      onClose={onClose}
      open={open}
      title="Wanted card"
    >
      <View style={styles.sheetBody}>
        <Text style={styles.bodyCopy}>Describe the particular card you are looking for.</Text>
        <View style={styles.photoRow}>
          <View style={styles.photoSlot} />
          <Pressable style={styles.photoBtn}>
            <Text style={styles.secondaryLabel}>Add reference photo</Text>
          </Pressable>
        </View>
        <Text style={styles.fieldLabel}>Notes</Text>
        <TextInput placeholder="Special inscription, signature, condition…" style={styles.field} />
        <Text style={styles.fieldLabel}>Source link</Text>
        <TextInput placeholder="https://instagram.com/…" style={styles.field} />
        <Pressable onPress={onClose} style={styles.gradeRow}>
          <View style={styles.limeCheck}>
            <Text style={styles.checkMark}>✓</Text>
          </View>
          <Text style={styles.plainRowTitle}>Grade</Text>
          <Text style={styles.cardRowSub}>Raw  ›</Text>
        </Pressable>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.plainRowTitle}>This exact physical card</Text>
            <Text style={styles.cardRowSub}>Another copy of the same parallel will not complete this target.</Text>
          </View>
          <Switch onValueChange={setExact} value={exact} />
        </View>
        <Pressable onPress={onClose} style={styles.cta}>
          <Text style={styles.ctaLabel}>Save</Text>
        </Pressable>
      </View>
    </SheetScaffold>
  );
}

function OfferSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState('');
  return (
    <SheetScaffold
      keyboardBehavior="extend"
      onClose={onClose}
      open={open}
      title="Make an offer"
    >
      <View style={styles.sheetBody}>
        <Text style={styles.bodyCopy}>#LOGO-6 Lewis Hamilton · listed at US$350.00</Text>
        <Text style={styles.fieldLabel}>Offer amount</Text>
        <TextInput
          keyboardType="decimal-pad"
          onChangeText={setAmount}
          placeholder="USD"
          style={styles.field}
          value={amount}
        />
        <Pressable onPress={onClose} style={styles.cta}>
          <Text style={styles.ctaLabel}>Send offer</Text>
        </Pressable>
      </View>
    </SheetScaffold>
  );
}

function ActionSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const stack = useSheetStack<'menu' | 'tags'>('menu');
  const [tags, setTags] = useState<string[]>(['TO SELL']);
  const allTags = ['FOR TRADE', 'SOLD', 'TO GRADE', 'TEST', 'CARDS', 'TO SELL'];
  return (
    <SheetScaffold
      onClose={() => {
        stack.reset();
        onClose();
      }}
      open={open}
      title={stack.page === 'menu' ? 'Debug card' : 'Add tag'}
    >
      {stack.page === 'menu' ? (
        <View style={styles.sheetBody}>
          <Text style={styles.cardRowSub}>sheet debug</Text>
          {(['Select', 'Add to folder', 'Add tag'] as const).map((label) => (
            <Pressable
              key={label}
              onPress={() => (label === 'Add tag' ? stack.push('tags') : onClose())}
              style={styles.plainRow}
            >
              <Text style={styles.plainRowTitle}>{label}</Text>
              <Text style={styles.cardRowSub}>{label === 'Select' ? '✓' : '>'}</Text>
            </Pressable>
          ))}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <Pressable onPress={onClose} style={[styles.secondary, { flex: 1 }]}>
              <Text style={styles.secondaryLabel}>Archive</Text>
            </Pressable>
            <Pressable onPress={onClose} style={[styles.secondary, { flex: 1 }]}>
              <Text style={[styles.secondaryLabel, { color: '#dc2626' }]}>Delete</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.sheetBody}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {allTags.map((tag) => {
              const on = tags.includes(tag);
              return (
                <Pressable
                  key={tag}
                  onPress={() =>
                    setTags((current) =>
                      on ? current.filter((item) => item !== tag) : [...current, tag]
                    )
                  }
                  style={[styles.secondary, on && { backgroundColor: '#ef4444' }]}
                >
                  <Text style={[styles.secondaryLabel, on && { color: '#fff' }]}>
                    {tag}
                    {on ? ' ✓' : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <SheetFooter onBack={stack.pop}>
            <Pressable onPress={onClose} style={styles.cta}>
              <Text style={styles.ctaLabel}>✓  Done</Text>
            </Pressable>
          </SheetFooter>
        </View>
      )}
    </SheetScaffold>
  );
}

function ScanSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [index, setIndex] = useState(1);
  return (
    <SheetScaffold
      detents={[0, '22%', '70%']}
      dismissible={false}
      indexOverride={open ? Math.max(index, 1) : 0}
      onClose={onClose}
      onIndexChange={(next) => setIndex(Math.max(1, next))}
      open={open}
      title="Scan results"
    >
      <View style={styles.sheetBody}>
        <Text style={styles.bodyCopy}>
          Persistent panel — drag peeks or expands. Scrim / swipe-down cannot close it.
        </Text>
        <Pressable onPress={() => setIndex(index >= 2 ? 1 : 2)} style={styles.secondary}>
          <Text style={styles.secondaryLabel}>{index >= 2 ? 'Collapse to peek' : 'Expand'}</Text>
        </Pressable>
      </View>
    </SheetScaffold>
  );
}

function PostSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <SheetScaffold onClose={onClose} open={open} title="Post">
      {['Reactions', 'Report post', 'Block this collector'].map((label) => (
        <Pressable key={label} onPress={onClose} style={styles.plainRow}>
          <Text style={[styles.plainRowTitle, label.startsWith('Block') && { color: '#dc2626' }]}>
            {label}
          </Text>
          <Text style={styles.cardRowSub}>{'>'}</Text>
        </Pressable>
      ))}
      <View style={{ height: 12 }} />
    </SheetScaffold>
  );
}

function PaywallSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <SheetScaffold onClose={onClose} open={open} title="Go Pro">
      <View style={styles.sheetBody}>
        <Text style={styles.bodyCopy}>
          Unlock auto-identify on scan, brand colour, Whatnot export, and gated sales history.
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>$4.99</Text>
          <Text style={styles.priceSub}>/ month</Text>
        </View>
        <Pressable onPress={onClose} style={styles.cta}>
          <Text style={styles.ctaLabel}>Upgrade to Pro</Text>
        </Pressable>
      </View>
    </SheetScaffold>
  );
}

const PALETTE = [
  '#38bdf8',
  '#22c55e',
  '#d97706',
  '#be123c',
  '#7c3aed',
  '#db2777',
  '#ea580c',
  '#2dd4bf',
  '#9ca3af',
  'rainbow',
] as const;

function Palette({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (color: string) => void;
}) {
  return (
    <View style={styles.palette}>
      {PALETTE.map((color) => (
        <Pressable
          key={color}
          onPress={() => onSelect(color)}
          style={[
            styles.paletteSwatch,
            color === 'rainbow' ? styles.rainbowSwatch : { backgroundColor: color },
            selected === color && styles.paletteOn,
          ]}
        />
      ))}
    </View>
  );
}

function CreateFolderSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [color, setColor] = useState('#38bdf8');
  const [name, setName] = useState('');
  return (
    <SheetScaffold keyboardBehavior="extend" onClose={onClose} open={open} title="Create folder">
      <View style={styles.sheetBody}>
        <Text style={styles.bodyCopy}>Pick a colour and name your folder.</Text>
        <Palette onSelect={setColor} selected={color} />
        <View style={styles.nameField}>
          <View
            style={[
              styles.nameSwatch,
              color === 'rainbow' ? styles.rainbowSwatch : { backgroundColor: color },
            ]}
          >
            <Text style={styles.nameSwatchEdit}>edit</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Folder name, e.g. Ferrari</Text>
            <TextInput
              onChangeText={setName}
              placeholder="Enter folder name, e.g. ferrari"
              style={styles.nameInput}
              value={name}
            />
          </View>
        </View>
        <Pressable onPress={onClose} style={styles.cta}>
          <Text style={styles.ctaLabel}>Create new folder</Text>
        </Pressable>
      </View>
    </SheetScaffold>
  );
}

function FolderActionSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const stack = useSheetStack<'menu' | 'delete'>('menu');
  return (
    <SheetScaffold
      onClose={() => {
        stack.reset();
        onClose();
      }}
      open={open}
      title={stack.page === 'menu' ? 'Folder' : 'Delete folder'}
    >
      {stack.page === 'menu' ? (
        <View style={styles.sheetBody}>
          <Pressable onPress={onClose} style={styles.menuCard}>
            <Text style={styles.menuIcon}>✎</Text>
            <Text style={styles.plainRowTitle}>Edit folder</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <Pressable onPress={() => stack.push('delete')} style={styles.menuCard}>
            <Text style={[styles.menuIcon, { color: '#dc2626' }]}>⌫</Text>
            <Text style={[styles.plainRowTitle, { color: '#dc2626' }]}>Delete folder</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.sheetBody}>
          <Text style={styles.bodyCopy}>This removes the folder. Cards inside are not deleted.</Text>
          <HoldToConfirmButton label="Hold to delete" onConfirm={onClose} />
          <SheetFooter onBack={stack.pop}>
            <Pressable onPress={stack.pop} style={styles.cta}>
              <Text style={styles.ctaLabel}>Keep folder</Text>
            </Pressable>
          </SheetFooter>
        </View>
      )}
    </SheetScaffold>
  );
}

function EditFolderSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [color, setColor] = useState('#111111');
  const [name, setName] = useState('Test');
  const [notes, setNotes] = useState('');
  return (
    <SheetScaffold keyboardBehavior="extend" onClose={onClose} open={open} title="Edit folder">
      <View style={styles.sheetBody}>
        <Text style={styles.bodyCopy}>Rename, recolour, or add a note for this folder.</Text>
        <Palette onSelect={setColor} selected={color} />
        <View style={styles.nameField}>
          <View
            style={[
              styles.nameSwatch,
              color === 'rainbow' ? styles.rainbowSwatch : { backgroundColor: color },
            ]}
          >
            <Text style={styles.nameSwatchEdit}>edit</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Folder name</Text>
            <TextInput onChangeText={setName} style={styles.nameInput} value={name} />
          </View>
        </View>
        <Text style={styles.fieldLabel}>Notes</Text>
        <TextInput
          multiline
          onChangeText={setNotes}
          placeholder="Add a note…"
          style={[styles.field, { minHeight: 72 }]}
          value={notes}
        />
        <Pressable onPress={onClose} style={styles.menuCard}>
          <Text style={styles.menuIcon}>🏷</Text>
          <Text style={styles.plainRowTitle}>Featured cards</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
        <Pressable onPress={onClose} style={styles.cta}>
          <Text style={styles.ctaLabel}>Save</Text>
        </Pressable>
      </View>
    </SheetScaffold>
  );
}

function NeededActionSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const rows = [
    { label: 'Wanted details', icon: '🏷', danger: false },
    { label: 'Select', icon: '✓', danger: false },
    { label: 'Add to folder', icon: '📁', danger: false },
    { label: 'Remove from folder', icon: '✕', danger: true },
  ];
  return (
    <SheetScaffold onClose={onClose} open={open} title="Debug card">
      <Text style={styles.subhead}>Still need</Text>
      <View style={styles.sheetBody}>
        {rows.map((row) => (
          <Pressable key={row.label} onPress={onClose} style={styles.menuCard}>
            <Text style={[styles.menuIcon, row.danger && { color: '#dc2626' }]}>{row.icon}</Text>
            <Text style={[styles.plainRowTitle, row.danger && { color: '#dc2626' }]}>{row.label}</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </View>
    </SheetScaffold>
  );
}

function AttachSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const rows = [
    { title: 'Photos from library', sub: 'Up to 10 photos', icon: '🖼', chevron: false },
    { title: 'Video from library', sub: 'Up to 60 seconds · 100 MB', icon: '▶', chevron: false },
    { title: 'Card from collection', sub: 'A card you own, with your photo', icon: '🃏', chevron: true },
    { title: 'Folder', sub: 'Share one of your folders', icon: '📁', chevron: true },
    { title: 'Card from checklist', sub: 'Any card in the catalogue', icon: '☑', chevron: true },
    { title: 'Poll', sub: 'Let people vote on choices', icon: '📊', chevron: true },
    { title: 'Emoji slider', sub: 'React by sliding an emoji', icon: '😊', chevron: true },
  ];
  return (
    <SheetScaffold onClose={onClose} open={open} title="Attach">
      <View style={styles.sheetBody}>
        {rows.map((row) => (
          <Pressable key={row.title} onPress={onClose} style={styles.attachRow}>
            <View style={styles.attachIcon}>
              <Text>{row.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardRowTitle}>{row.title}</Text>
              <Text style={styles.cardRowSub}>{row.sub}</Text>
            </View>
            {row.chevron ? <Text style={styles.chevron}>›</Text> : null}
          </Pressable>
        ))}
        <SheetFooter onBack={onClose}>
          <Pressable onPress={onClose} style={styles.cta}>
            <Text style={styles.ctaLabel}>Done</Text>
          </Pressable>
        </SheetFooter>
      </View>
    </SheetScaffold>
  );
}

function PollSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [length, setLength] = useState('1d');
  const lengths = ['1h', '6h', '1d', '3d', '1w'] as const;
  return (
    <SheetScaffold onClose={onClose} open={open} title="Poll">
      <View style={styles.sheetBody}>
        <Text style={styles.bodyCopy}>Ask your question in the post text. Voters see live results.</Text>
        <View style={styles.field}>
          <Text style={styles.plainRowTitle}>Yes</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.plainRowTitle}>No</Text>
        </View>
        <Pressable style={styles.addChoice}>
          <Text style={styles.addChoiceLabel}>+  Add a choice</Text>
        </Pressable>
        <View style={styles.pollLengthHead}>
          <Text style={styles.fieldLabel}>Poll length</Text>
          <Text style={styles.pollLengthValue}>
            {length === '1d' ? '1 day' : length}
          </Text>
        </View>
        <View style={styles.pollTrack}>
          {lengths.map((item) => (
            <Pressable
              key={item}
              onPress={() => setLength(item)}
              style={[styles.pollTick, length === item && styles.pollTickOn]}
            >
              <Text style={[styles.pollTickLabel, length === item && styles.pollTickLabelOn]}>{item}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </SheetScaffold>
  );
}

function ReactionsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <SheetScaffold onClose={onClose} open={open} title="Reactions">
      <View style={[styles.sheetBody, styles.emptyBody]}>
        <Text style={styles.emptyGlyph}>▮▮</Text>
        <Text style={styles.emptyCopy}>Loading reactions…</Text>
        <SheetFooter onBack={onClose}>
          <Pressable onPress={onClose} style={styles.cta}>
            <Text style={styles.ctaLabel}>Done</Text>
          </Pressable>
        </SheetFooter>
      </View>
    </SheetScaffold>
  );
}

function BlockedSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <SheetScaffold onClose={onClose} open={open} title="Blocked collectors">
      <View style={[styles.sheetBody, styles.emptyBody]}>
        <Text style={styles.bodyCopy}>Blocked collectors won’t show up in your community feed.</Text>
        <Text style={styles.emptyTitle}>No blocked collectors</Text>
        <Text style={styles.emptyCopy}>Anyone you block will appear here.</Text>
      </View>
    </SheetScaffold>
  );
}

function ProfileDesignSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const fonts = ['Condensed', 'Script', 'Pixel'] as const;
  const colors = ['auto', '#fff', '#111', '#f472b6', '#3b82f6', '#22c55e', '#d97706', '#dc2626', '#7c3aed', '#ea580c', '#14b8a6', 'rainbow'];
  const [font, setFont] = useState<(typeof fonts)[number]>('Script');
  const [ink, setInk] = useState('#fff');
  return (
    <SheetScaffold onClose={onClose} open={open} title="Text">
      <View style={styles.sheetBody}>
        <Text style={styles.bodyCopy}>Your display font and text colour, previewed live behind this sheet.</Text>
        <Text style={styles.fieldLabel}>Font</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fontRow}>
          {fonts.map((item) => (
            <Pressable
              key={item}
              onPress={() => setFont(item)}
              style={[styles.fontChip, font === item && styles.fontChipOn]}
            >
              <Text style={[styles.fontChipLabel, font === item && styles.fontChipLabelOn]}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Text style={styles.fieldLabel}>Text colour</Text>
        <View style={styles.palette}>
          {colors.map((color) => (
            <Pressable
              key={color}
              onPress={() => setInk(color)}
              style={[
                styles.paletteSwatch,
                color === 'auto'
                  ? styles.autoSwatch
                  : color === 'rainbow'
                    ? styles.rainbowSwatch
                    : { backgroundColor: color, borderWidth: color === '#fff' ? 1 : 0, borderColor: '#d4d4d8' },
                ink === color && styles.paletteOn,
              ]}
            >
              {color === 'auto' ? <Text style={styles.autoLabel}>Auto</Text> : null}
            </Pressable>
          ))}
        </View>
        <SheetFooter onBack={onClose}>
          <Pressable onPress={onClose} style={styles.cta}>
            <Text style={styles.ctaLabel}>Save design</Text>
          </Pressable>
        </SheetFooter>
      </View>
    </SheetScaffold>
  );
}

const LIME = '#c6ff1a';

const styles = StyleSheet.create({
  screen: { backgroundColor: '#f2f2f4', flex: 1 },
  catalog: { paddingBottom: 40, paddingHorizontal: 16, paddingTop: 8 },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    minHeight: 44,
  },
  backChevron: { color: '#111', fontSize: 32, lineHeight: 34, width: 36 },
  brand: { color: LIME, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  gear: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 18,
    elevation: 3,
    height: 36,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    width: 36,
  },
  gearGlyph: { fontSize: 18 },
  intro: { color: '#3f3f46', fontSize: 14, lineHeight: 20, marginBottom: 18 },
  section: { marginBottom: 8 },
  sectionTitle: { color: '#111', fontSize: 20, fontWeight: '700', marginBottom: 10, marginTop: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    padding: 16,
  },
  cardTitle: { color: '#111', fontSize: 16, fontWeight: '700' },
  cardBlurb: { color: '#52525b', fontSize: 13.5, lineHeight: 19, marginTop: 6 },
  cardNote: { color: '#65a30d', fontSize: 13, lineHeight: 18, marginTop: 8 },
  cardWarn: { color: '#b91c1c', fontSize: 13, lineHeight: 18, marginTop: 8 },
  openBtn: {
    alignItems: 'center',
    backgroundColor: '#efeff1',
    borderRadius: 12,
    marginTop: 14,
    paddingVertical: 11,
  },
  openLabel: { color: '#111', fontSize: 16, fontWeight: '600' },
  sheetBody: { gap: 12, paddingBottom: 18, paddingHorizontal: 16 },
  bodyCopy: { color: '#3f3f46', fontSize: 15, lineHeight: 21 },
  subhead: { color: '#71717a', fontSize: 13, paddingHorizontal: 16, paddingVertical: 4 },
  hint: { color: '#71717a', fontSize: 13, paddingBottom: 12, textAlign: 'center' },
  emojiRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  emojiChip: {
    alignItems: 'center',
    backgroundColor: '#f4f4f5',
    borderRadius: 14,
    flex: 1,
    height: 52,
    justifyContent: 'center',
  },
  emoji: { fontSize: 24 },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  emojiGridHit: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: '12.5%',
  },
  emojiGridItem: { fontSize: 26 },
  emojiTabs: { flexGrow: 0, paddingHorizontal: 12, paddingVertical: 6 },
  emojiTab: { marginRight: 16, paddingVertical: 6 },
  emojiTabLabel: { color: '#a1a1aa', fontSize: 15, fontWeight: '600' },
  emojiTabOn: { color: LIME, fontWeight: '800' },
  cardRow: {
    alignItems: 'center',
    backgroundColor: '#f4f4f5',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginVertical: 4,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  thumb: { backgroundColor: '#d4d4d8', borderRadius: 6, height: 44, width: 32 },
  cardRowTitle: { color: '#111', fontSize: 14, fontWeight: '700' },
  cardRowSub: { color: '#71717a', fontSize: 12, marginTop: 2 },
  plus: { color: '#a1a1aa', fontSize: 22, fontWeight: '400', width: 22 },
  plusOn: { color: '#111', fontWeight: '700' },
  searchBox: { paddingHorizontal: 16, paddingTop: 8 },
  searchInput: {
    backgroundColor: '#f4f4f5',
    borderRadius: 14,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sheetPad: { paddingHorizontal: 16, paddingTop: 10 },
  field: {
    backgroundColor: '#f4f4f5',
    borderRadius: 12,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  fieldLabel: { color: '#111', fontSize: 14, fontWeight: '700' },
  cta: {
    alignItems: 'center',
    backgroundColor: LIME,
    borderRadius: 16,
    height: 52,
    justifyContent: 'center',
  },
  ctaLabel: { color: '#111', fontSize: 16, fontWeight: '800' },
  plainRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  plainRowTitle: { color: '#111', flex: 1, fontSize: 17, fontWeight: '600' },
  radio: {
    borderColor: '#d4d4d8',
    borderRadius: 11,
    borderWidth: 2,
    height: 22,
    width: 22,
  },
  radioOn: { backgroundColor: LIME, borderColor: LIME },
  folderRow: {
    alignItems: 'center',
    backgroundColor: '#f4f4f5',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginVertical: 4,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  swatchDot: { borderRadius: 6, height: 18, width: 18 },
  check: {
    alignItems: 'center',
    borderColor: '#d4d4d8',
    borderRadius: 6,
    borderWidth: 2,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  checkOn: { backgroundColor: '#111', borderColor: '#111' },
  checkMark: { color: '#fff', fontSize: 12, fontWeight: '800' },
  folderFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 18,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  plusBtn: {
    alignItems: 'center',
    backgroundColor: '#efeff1',
    borderRadius: 16,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  plusBtnGlyph: { color: '#111', fontSize: 28, lineHeight: 30 },
  secondary: {
    alignItems: 'center',
    backgroundColor: '#f4f4f5',
    borderRadius: 14,
    paddingVertical: 14,
  },
  secondaryLabel: { color: '#111', fontWeight: '700' },
  colorField: {
    alignItems: 'center',
    backgroundColor: '#f4f4f5',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 10,
    padding: 10,
  },
  colorPreview: { backgroundColor: '#208AEF', borderRadius: 8, height: 28, width: 28 },
  hex: { color: '#111', fontSize: 16, fontWeight: '600' },
  gradient: { backgroundColor: '#208AEF', borderRadius: 12, height: 120 },
  hue: {
    backgroundColor: '#ff0000',
    borderRadius: 10,
    height: 18,
  },
  photoRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  photoSlot: { backgroundColor: '#ececee', borderRadius: 12, height: 88, width: 72 },
  photoBtn: {
    backgroundColor: '#f4f4f5',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  toggleRow: {
    alignItems: 'center',
    backgroundColor: '#f4f4f5',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  priceRow: { alignItems: 'flex-end', flexDirection: 'row', gap: 6 },
  price: { color: '#111', fontSize: 32, fontWeight: '800' },
  priceSub: { color: '#71717a', fontSize: 16, marginBottom: 4 },
  gradeRow: {
    alignItems: 'center',
    backgroundColor: '#f4f4f5',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  limeCheck: {
    alignItems: 'center',
    backgroundColor: LIME,
    borderRadius: 8,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  paletteSwatch: { borderRadius: 10, height: 36, width: 36 },
  paletteOn: { borderColor: LIME, borderWidth: 3 },
  rainbowSwatch: { backgroundColor: '#f59e0b' },
  autoSwatch: {
    alignItems: 'center',
    backgroundColor: '#f4f4f5',
    justifyContent: 'center',
  },
  autoLabel: { color: '#111', fontSize: 9, fontWeight: '800' },
  nameField: {
    alignItems: 'center',
    backgroundColor: '#f4f4f5',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 10,
    padding: 10,
  },
  nameSwatch: {
    alignItems: 'center',
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  nameSwatchEdit: { color: '#fff', fontSize: 11, fontWeight: '700' },
  nameInput: { fontSize: 16, paddingVertical: 6 },
  menuCard: {
    alignItems: 'center',
    backgroundColor: '#f4f4f5',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  menuIcon: { fontSize: 16, width: 22 },
  chevron: { color: '#a1a1aa', fontSize: 22 },
  attachRow: {
    alignItems: 'center',
    backgroundColor: '#f4f4f5',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  attachIcon: {
    alignItems: 'center',
    backgroundColor: '#ecfccb',
    borderRadius: 10,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  addChoice: { alignItems: 'center', paddingVertical: 8 },
  addChoiceLabel: { color: LIME, fontSize: 16, fontWeight: '800' },
  pollLengthHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pollLengthValue: { color: LIME, fontSize: 15, fontWeight: '700' },
  pollTrack: {
    alignItems: 'flex-end',
    backgroundColor: '#f4f4f5',
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  pollTick: { alignItems: 'center', flex: 1, paddingVertical: 8 },
  pollTickOn: { backgroundColor: '#fff', borderRadius: 12 },
  pollTickLabel: { color: '#71717a', fontSize: 13, fontWeight: '600' },
  pollTickLabelOn: { color: '#111', fontWeight: '800' },
  emptyBody: { alignItems: 'center', paddingVertical: 28 },
  emptyGlyph: { color: LIME, fontSize: 36, fontWeight: '800', marginBottom: 8 },
  emptyTitle: { color: '#111', fontSize: 20, fontWeight: '800', marginTop: 16 },
  emptyCopy: { color: '#71717a', fontSize: 15, textAlign: 'center' },
  fontRow: { flexGrow: 0 },
  fontChip: {
    backgroundColor: '#f4f4f5',
    borderRadius: 12,
    marginRight: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  fontChipOn: { backgroundColor: '#fff' },
  fontChipLabel: { color: '#71717a', fontSize: 16, fontWeight: '600' },
  fontChipLabelOn: { color: '#111', fontWeight: '800' },
});
