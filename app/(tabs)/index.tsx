import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { MaterialIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Alert,
  BackHandler,
  Easing,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { AppState, type AppStateStatus } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import {
  createOrder,
  createEndGameOrder,
  END_GAME_LEVEL_COUNT,
  formatLevel,
  getEndGameConfig,
  getLevelConfig,
  getStormConfig,
  moveOrder,
  STORM_LEVEL_COUNT,
  type GameMode,
  type LevelConfig,
} from "@/lib/redx-game";

/**
 * Main screen maintainer map:
 * - COPY contains every user-facing English/Arabic string.
 * - HomeScreen owns onboarding, saved profile, game phases, and level flow.
 * - InstructionsModal/ProfileModal are reusable overlays.
 * - `redx-game.ts` owns numeric difficulty rules; change that file first when
 *   tuning balls, ball sizes, shuffles, speeds, or level limits.
 * - AsyncStorage keys below are local-only persistence; changing a key resets
 *   that category for existing installs.
 */
type Phase = "ready" | "countdown" | "watching" | "selecting" | "result";
type Result = "correct" | "lost" | null;
type GameType = "focus" | "storm";
type AppStage = "onboarding" | "menu" | "game";
type InstructionContext = "focus" | "storm" | null;
type Language = "en" | "ar";
type Point = { x: number; y: number };
type Velocity = { x: number; y: number };

type SaveState = {
  campaignLevel: number;
  infiniteBest: number;
  stormBest: number;
};

const STORAGE_KEY = "redx-progress-v2";
const ONBOARDING_KEY = "redx-onboarding-v2";
const PROFILE_KEY = "redx-profile-v2";
const RED = "#ff3b30";
const BLUE = "#2d9cff";
const BG = "#07080b";
const SURFACE = "#111318";
const LINE = "#2d3038";
const MUTED = "#898d99";
const BALL_SIZE = 38;
const STORM_BALLS = 12;
const STORM_DURATION = 30;

// Keep translation keys mirrored between `en` and `ar`; missing keys cause a
// visible fallback problem when users switch language from Settings.
const COPY = {
  en: {profile: "YOUR FOCUS PROFILE", profileCopy: "Choose a name and a two-tone avatar. Your progress stays on this device.", chooseAvatar: "CHOOSE AVATAR", continueGuest: "CONTINUE AS GUEST", yourName: "Your name", trust: "TRUST YOUR EYES", heroCopy: "A precision focus game built around one rule: watch the red, then find it again.", chooseArena: "CHOOSE YOUR ARENA — THEN TRUST YOUR EYES.", focusTrack: "FOCUS TRACK", focusCopy: "INFINITE or END GAME · controlled orbit", redStorm: "RED STORM", stormCopy: "20 levels · moving origin · countdown", exit: "EXIT GAME", back: "BACK", infinite: "INFINITE", infiniteCopy: "Endless rounds · escalating speed", endGame: "END GAME", endCopy: "20 levels · two reds, then three", ready: "READY WHEN YOU ARE", letsPlay: "LET'S PLAY", briefing: "BRIEFING", watchRed: "Keep your eyes on the red ball", trackOrigin: "Track the origin ball through the storm", round: "ROUND", level: "LEVEL", endless: "ENDLESS", focus: "FOCUS", balls: "BALLS", staySharp: "STAY SHARP. TRUST YOUR EYES.", startRound: "START ROUND", nextRound: "NEXT ROUND", replay: "REPLAY", mainMenu: "MAIN MENU", correct: "CORRECT", missed: "MISSED", redFound: "RED FOUND", redLost: "YOU LOST RED", whereRed: "WHERE IS RED?", tapTracked: "Tap the ball you tracked", tapOne: "TAP ONE", tapReds: "REDS", redQuestion: "RED?", follow: "FOLLOW THE BALL", getReady: "GET READY", dontLose: "DON'T LOSE THE", redBall: "RED BALL", yourFocus: "Your focus starts here.", stormLabel: "STORM", seconds: "SEC", shuffles: "SHUFFLES", training: "TRAINING", speedWorld: "SPEED", chaos: "CHAOS", endWorld: "END GAME", decoy: "DECOY FLASH", freeze: "FREEZE RECALL", shrinking: "SHRINKING ARENA", oneRed: "ONE RED", twoRedTargets: "TWO REDS", wallRun: "WALL RUN", collision: "COLLISION", settings: "PROFILE / SETTINGS", playerName: "PLAYER NAME", sound: "Sound effects", music: "Background music", vibration: "Vibration", on: "ON", off: "OFF", done: "DONE", privacy: "Privacy Policy", terms: "Terms of Service", close: "CLOSE", language: "Language", english: "English", arabic: "العربية", trackRedTitle: "TRACK THE RED BALL", trackRedCopy: "A focused reaction game built around one simple rule: watch closely, trust your eyes, and do not lose red.", enterName: "Enter your name", startGuest: "START AS GUEST", howToPlay: "HOW TO PLAY", gotIt: "GOT IT", levelMap: "LEVEL MAP", closeMap: "CLOSE MAP", twoReds: "TWO REDS", privacyCopy: "REDX stores your player name, avatar choice, settings, and progress locally on this device. We do not sell personal data or use advertising tracking in this build. You can reset local data by clearing the app storage.", termsCopy: "REDX is a personal focus game. Play fairly, keep the app updated, and use it only for entertainment. Progress and settings are stored locally and may be removed if the app is uninstalled.", levelMapCopy: "Focus Track is split into two independent paths. Infinite never ends; End Game always starts at level 01 with two red targets."},
  ar: {profile: "ملفك الشخصي", profileCopy: "اختر اسمًا وصورة رمزية . سيظل تقدمك محفوظًا على هذا الجهاز.", chooseAvatar: "اختر الصورة الرمزية", continueGuest: "المتابعة بوصفك ضيفًا", yourName: "اسمك", trust: "ثق بقدرتك على التركيز", heroCopy: "لعبة تركيز دقيقة تقوم على قاعدة واحدة : راقب الكرة الحمراء، ثم حدّد موقعها مجددًا.", chooseArena: "اختر ساحتك — ثم ثق بقدرتك على التركيز.", focusTrack: "مسار التركيز", focusCopy: "الوضع اللانهائي أو  وضع نهاية اللعبة · حركة مدارية متحكَّم بها", redStorm: "العاصفة الحمراء", stormCopy: "20 مستوى · نقطة انطلاق متحركة · عدّ تنازلي", exit: "مغادرة اللعبة", back: "رجوع", infinite: "الوضع اللانهائي", infiniteCopy: "جولات بلا نهاية · سرعة متصاعدة", endGame: "وضع نهاية اللعبة", endCopy: "20 مستوى · كرتان حمراوان، ثم ثلاث كرات", ready: "جاهز عندما تكون مستعدًا", letsPlay: "لنبدأ اللعب", briefing: "تعليمات اللعب", watchRed: "لاتبعد عيناك عن الكرة الحمراء", trackOrigin: "تتبّع الكرة الأصلية وسط العاصفة", round: "الجولة", level: "المستوى", endless: "بلا نهاية", focus: "التركيز", balls: "الكرات", staySharp: "ابقَ يقظًا. ثق بقدرتك على التركيز.", startRound: "بدء الجولة", nextRound: "الجولة التالية", replay: "إعادة المحاولة", mainMenu: "القائمة الرئيسية", correct: "إجابة صحيحة", missed: "أخفقت", redFound: "تم العثور على الكرة الحمراء", redLost: "فقدت الكرة الحمراء", whereRed: "أين الكرة الكرة الحمراء؟", tapTracked: "اضغط على الكرة التي تتبعتها", tapOne: "اضغط على واحدة", tapReds: "الكرات الحمراء", redQuestion: "الكرة الحمراء؟", follow: "اتبع الكرة", getReady: "استعد", dontLose: "لا تفقدها", redBall: "الكرة الحمراء", yourFocus: "يبدأ اختبار تركيزك هنا.", stormLabel: "العاصفة", seconds: "ثانية", shuffles: "التبديلات", training: "التدريب", speedWorld: "السرعة", chaos: "الفوضى", endWorld: "وضع نهاية اللعبة", decoy: "وميض التضليل", freeze: "استدعاء الذاكرة بعد التجميد", shrinking: "ساحة متقلصة", oneRed: "كرة حمراء واحدة", twoRedTargets: "كرتان حمراوان", wallRun: "الجري على الجدران", collision: "التصادم", settings: "الملف الشخصي / الإعدادات", playerName: "اسم اللاعب", sound: "المؤثرات الصوتية", music: "الموسيقى في الخلفية", vibration: "الاهتزاز", on: "مفعّل", off: "معطّل", done: "تم", privacy: "سياسة الخصوصية", terms: "شروط الاستخدام", close: "إغلاق", language: "اللغة", english: "الإنجليزية", arabic: "العربية", trackRedTitle: "تتبّع الكرة الحمراء", trackRedCopy: "لعبة ردّ فعل وتركيز - تقوم على قاعدة بسيطة: راقب جيدًا، وثق بقدرتك على التركيز، ولا تفقد الكرة الحمراء.", enterName: "أدخل اسمك", startGuest: "ابدأ كضيف", howToPlay: "كيفية اللعب", gotIt: "فهمت", levelMap: "خريطة المستويات", closeMap: "إغلاق الخريطة", twoReds: "كرتان حمراوان", privacyCopy: "REDX اسم اللاعب واختيار الصورة الرمزية والإعدادات والتقدم محليًا على هذا الجهاز. نحن لا نبيع البيانات الشخصية ولا نستخدم التتبع الإعلاني في هذا الإصدار. يمكنك إعادة ضبط البيانات المحلية عبر مسح مساحة تخزين التطبيق.", termsCopy: "REDX لعبة تركيز شخصية. العب بنزاهة، وحافظ على تحديث التطبيق، واستخدمه للترفيه فقط. يتم تخزين التقدم والإعدادات محليًا، وقد تُحذف إذا أزيل التطبيق.", levelMapCopy: "ينقسم مسار التركيز إلى مسارين مستقلين. الوضع اللانهائي لا ينتهي أبدًا؛ ووضع نهاية اللعبة دائمًا يبدأ  بهدفين أحمرين."},
} as const;

function createStormPositions(count: number, size: number, ballSize: number): Point[] {
  const center = size / 2;
  const radius = size * 0.27;
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
    return {
      x: center + Math.cos(angle) * radius - ballSize / 2,
      y: center + Math.sin(angle) * radius - ballSize / 2,
    };
  });
}

function createStormVelocities(count: number, speed: number): Velocity[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = index * 2.41 + 0.7;
    const variedSpeed = speed + (index % 4) * 12;
    return { x: Math.cos(angle) * variedSpeed, y: Math.sin(angle) * variedSpeed };
  });
}

const INITIAL_SAVE: SaveState = { campaignLevel: 1, infiniteBest: 0, stormBest: 0 };
const AVATARS = [
  { id: "girl-1", label: "G1", icon: "face-3" as const },
  { id: "girl-2", label: "G2", icon: "face-4" as const },
  { id: "girl-3", label: "G3", icon: "face-6" as const },
  { id: "boy-1", label: "B1", icon: "face" as const },
  { id: "boy-2", label: "B2", icon: "face-2" as const },
  { id: "boy-3", label: "B3", icon: "face-5" as const },
];

/** Reusable instruction sheet shown before a player enters a lab or mode. */
function InstructionsModal({ context, focusMode, language, onClose }: { context: Exclude<InstructionContext, null>; focusMode?: GameMode | null; language: Language; onClose: () => void }) {
  const t = COPY[language];
  const isStorm = context === "storm";
  const title = isStorm ? `${t.redStorm} ${t.briefing}` : focusMode === "campaign" ? `${t.endGame} ${t.briefing}` : focusMode === "infinite" ? `${t.infinite} ${t.briefing}` : `${t.focusTrack} ${t.briefing}`;
  const copy = isStorm
    ? language === "ar" ? "حدّد الكرة الحمراء الأصلية قبل بدء العاصفة. حافظ على تركيزك عليها أثناء تحرك جميع الكرات، ثم اضغط على موقعها النهائي." : "Find the red origin ball before the storm begins. Keep your eyes locked on it while every ball moves, then tap its final position."
    : focusMode === "campaign"
      ? language === "ar" ? "وضع نهاية اللعبة تحدٍّ يتطلب تركيزًا عاليًا. راقب الأهداف الحمراء، وانتظر توقف الساحة، ثم اضغط على كل كرة حمراء قبل انتهاء الجولة." : "End Game is a focused challenge. Watch the red targets, wait for the arena to stop, then tap every red ball before the round ends."
      : focusMode === "infinite"
        ? language === "ar" ? "يستمر الوضع اللانهائي ما دام تركيزك حاضرًا. راقب الكرة الحمراء خلال كل تبديل، ثم اضغط عليها عند توقف الحركة." : "Infinite keeps going as long as your focus holds. Watch the red ball through every shuffle, then tap it when the motion stops."
        : language === "ar" ? "مسار التركيز بسيط: راقب الكرة الحمراء، واتبع كل تبديل، وثق بقدرتك على التركيز عندما تتوقف الساحة." : "Focus Track is simple: watch the red ball, follow every shuffle, and trust your eyes when the arena stops.";
  const rules = isStorm
    ? language === "ar" ? ["احفظ موقع الكرة الحمراء الأصلية.", "اصمد أمام العاصفة المتحركة.", "اضغط على الكرة الحمراء في النهاية."] : ["Memorize the red origin.", "Survive the moving storm.", "Tap the red ball at the end."]
    : focusMode === "campaign"
      ? language === "ar" ? ["راقب كل هدف أحمر.", "انتظر توقف الحركة.", "اضغط على كل كرة حمراء."] : ["Watch every red target.", "Wait until all motion stops.", "Tap every red ball."]
      : language === "ar" ? ["راقب الكرة الحمراء.", "اتبع كل حركة.", "اضغط على الموضع الذي تتذكره."] : ["Watch the red ball.", "Follow every shuffle.", "Tap the position you remember."];

  return (
    <View style={styles.modalBackdrop}>
      <View style={styles.modalCard}>
          <View style={[styles.modalHeader, language === "ar" && styles.rtlRow]}>
          <View><Text style={[styles.modalTitle, language === "ar" && styles.rtlText]}>{title}</Text><Text style={styles.instructionTag}>{t.ready}</Text></View>
          <Pressable accessibilityLabel={t.close} onPress={onClose} style={styles.modalClose}><MaterialIcons name="close" size={20} color="#f7f7f8" /></Pressable>
        </View>
        <Text style={[styles.modalCopy, language === "ar" && styles.rtlText]}>{copy}</Text>
        {rules.map((rule, index) => <View key={rule} style={[styles.ruleRow, language === "ar" && styles.rtlRow]}><Text style={styles.ruleNumber}>{`0${index + 1}`}</Text><Text style={[styles.ruleText, language === "ar" && styles.rtlText]}>{rule}</Text></View>)}
        <Pressable onPress={onClose} style={[styles.primaryButton, language === "ar" && styles.rtlRow]}><Text style={styles.primaryButtonText}>{t.letsPlay}</Text><MaterialIcons name={language === "ar" ? "arrow-back" : "arrow-forward"} size={18} color={BG} /></Pressable>
      </View>
    </View>
  );
}

function ProfileModal({ username, setUsername, avatarId, setAvatarId, soundOn, setSoundOn, musicOn, setMusicOn, vibrationOn, setVibrationOn, language, setLanguage, onClose, onLegal }: any) {
  const t = COPY[language as Language];
  const rtl = language === "ar";
  return <View style={styles.modalBackdrop}><View style={styles.modalCard}><View style={[styles.modalHeader, rtl && styles.rtlRow]}><Text style={[styles.modalTitle, rtl && styles.rtlText]}>{t.settings}</Text><Pressable accessibilityLabel={t.close} onPress={onClose} style={styles.modalClose}><MaterialIcons name="close" size={20} color="#f7f7f8" /></Pressable></View><Text style={[styles.profileLabel, rtl && styles.rtlText]}>{t.playerName}</Text><TextInput value={rtl && username === "Guest" ? "" : username} onChangeText={setUsername} placeholder={t.yourName} placeholderTextColor="#686d77" maxLength={12} style={[styles.modalInput, rtl && styles.rtlText]} /><Text style={[styles.profileLabel, rtl && styles.rtlText]}>{t.chooseAvatar}</Text><View style={[styles.avatarGrid, rtl && styles.rtlRow]}>{AVATARS.map((avatar) => <Pressable key={avatar.id} onPress={() => setAvatarId(avatar.id)} style={[styles.avatarChoice, avatarId === avatar.id && styles.avatarChoiceActive]}><MaterialIcons name={avatar.icon} size={24} color={avatarId === avatar.id ? RED : "#f7f7f8"} /></Pressable>)}</View><View style={[styles.settingsRow, rtl && styles.rtlRow]}><Text style={[styles.ruleText, rtl && styles.rtlText]}>{t.language}</Text><View style={[styles.languageChoices, rtl && styles.rtlRow]}><Pressable onPress={() => setLanguage("en")} style={[styles.languageChoice, language === "en" && styles.languageChoiceActive]}><Text style={styles.languageText}>{t.english}</Text></Pressable><Pressable onPress={() => setLanguage("ar")} style={[styles.languageChoice, language === "ar" && styles.languageChoiceActive]}><Text style={styles.languageText}>{t.arabic}</Text></Pressable></View></View><View style={[styles.settingsRow, rtl && styles.rtlRow]}><Text style={[styles.ruleText, rtl && styles.rtlText]}>{t.sound}</Text><Pressable onPress={() => setSoundOn((value: boolean) => !value)} style={[styles.toggle, soundOn && styles.toggleActive]}><Text style={styles.toggleText}>{soundOn ? t.on : t.off}</Text></Pressable></View><View style={[styles.settingsRow, rtl && styles.rtlRow]}><Text style={[styles.ruleText, rtl && styles.rtlText]}>{t.music}</Text><Pressable onPress={() => setMusicOn((value: boolean) => !value)} style={[styles.toggle, musicOn && styles.toggleActive]}><Text style={styles.toggleText}>{musicOn ? t.on : t.off}</Text></Pressable></View><View style={[styles.settingsRow, rtl && styles.rtlRow]}><Text style={[styles.ruleText, rtl && styles.rtlText]}>{t.vibration}</Text><Pressable onPress={() => setVibrationOn((value: boolean) => !value)} style={[styles.toggle, vibrationOn && styles.toggleActive]}><Text style={styles.toggleText}>{vibrationOn ? t.on : t.off}</Text></Pressable></View><Pressable onPress={() => onLegal("privacy")} style={styles.linkButton}><Text style={[styles.linkText, rtl && styles.rtlText]}>{t.privacy}</Text></Pressable><Pressable onPress={() => onLegal("terms")} style={styles.linkButton}><Text style={[styles.linkText, rtl && styles.rtlText]}>{t.terms}</Text></Pressable><Pressable onPress={onClose} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{t.done}</Text></Pressable></View></View>;
}

function LegalModal({ kind, language, onClose }: { kind: "privacy" | "terms"; language: Language; onClose: () => void }) {
  const t = COPY[language];
  const privacy = kind === "privacy";
  return <View style={styles.modalBackdrop}><View style={styles.modalCard}><View style={[styles.modalHeader, language === "ar" && styles.rtlRow]}><Text style={[styles.modalTitle, language === "ar" && styles.rtlText]}>{privacy ? t.privacy : t.terms}</Text><Pressable accessibilityLabel={t.close} onPress={onClose} style={styles.modalClose}><MaterialIcons name="close" size={20} color="#f7f7f8" /></Pressable></View><Text style={[styles.legalText, language === "ar" && styles.rtlText]}>{privacy ? t.privacyCopy : t.termsCopy}</Text><Pressable onPress={onClose} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{t.close}</Text></Pressable></View></View>;
}

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const arenaSize = Math.min(Math.max(width, 390) - 40, 360);
  const [mode, setMode] = useState<GameMode>("infinite");
  const [gameType, setGameType] = useState<GameType>("focus");
  const [appStage, setAppStage] = useState<AppStage>("onboarding");
  const [endGameLevel, setEndGameLevel] = useState(1);
  const [infiniteLevel, setInfiniteLevel] = useState(1);
  const [stormLevel, setStormLevel] = useState(1);
  const [save, setSave] = useState<SaveState>(INITIAL_SAVE);
  const [phase, setPhase] = useState<Phase>("ready");
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(0);
  const [displayOrder, setDisplayOrder] = useState<number[]>(() => createOrder(10));
  const [stormPositions, setStormPositions] = useState<Point[]>(() => createStormPositions(STORM_BALLS, arenaSize, 46));
  const [result, setResult] = useState<Result>(null);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<number[]>([]);
  const [showGuide, setShowGuide] = useState(false);
  const [showLevels, setShowLevels] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showFocusChoices, setShowFocusChoices] = useState(false);
  // The first sheet explains the lab; the second sheet explains the selected mode.
  const [instructionContext, setInstructionContext] = useState<InstructionContext>(null);
  const [pendingFocusMode, setPendingFocusMode] = useState<GameMode | null>(null);
  const [username, setUsername] = useState("Guest");
  const [avatarId, setAvatarId] = useState("girl-1");
  const [language, setLanguage] = useState<Language>("en");
  const [soundOn, setSoundOn] = useState(true);
  const [musicOn, setMusicOn] = useState(true);
  const [vibrationOn, setVibrationOn] = useState(true);
  const [showLegal, setShowLegal] = useState<"privacy" | "terms" | null>(null);
  const [decoySlot, setDecoySlot] = useState<number | null>(null);
  const tapPlayer = useAudioPlayer(require("../../assets/audio/tap.mp3"));
  const countdownPlayer = useAudioPlayer(require("../../assets/audio/countdown.mp3"));
  const goPlayer = useAudioPlayer(require("../../assets/audio/go.mp3"));
  const correctPlayer = useAudioPlayer(require("../../assets/audio/correct.mp3"));
  const wrongPlayer = useAudioPlayer(require("../../assets/audio/wrong.mp3"));
  const musicPlayer = useAudioPlayer(require("../../assets/audio/redx-loop.mp3"));
  const [roundStartedAt, setRoundStartedAt] = useState(0);
  const [shuffleStep, setShuffleStep] = useState(0);
  const pulse = useRef(new Animated.Value(1)).current;
  const selectedSlotRef = useRef<number | null>(null);
  const stormVelocities = useRef<Velocity[]>(createStormVelocities(STORM_BALLS, 115));
  const t = COPY[language];
  const rtl = language === "ar";

  const currentLevel = mode === "campaign" ? endGameLevel : infiniteLevel;
  const config = useMemo(() => mode === "campaign" ? getEndGameConfig(endGameLevel) : getLevelConfig("infinite", infiniteLevel), [endGameLevel, infiniteLevel, mode]);
  const stormConfig = useMemo(() => getStormConfig(stormLevel), [stormLevel]);
  const roundDuration = gameType === "storm" ? stormConfig.duration : config.duration;
  const isStorm = gameType === "storm";
  const redSlots = displayOrder.reduce<number[]>((slots, ballId, index) => ballId < (isStorm ? 1 : config.redCount) ? [...slots, index] : slots, []);
  const redSlot = redSlots[0] ?? 0;
  // Focus Track gets denser as levels rise: more balls are paired with smaller targets.
  const activeBallSize = isStorm ? stormConfig.ballSize : config.ballSize;
  const arenaRadius = arenaSize * 0.36;
  const focusRadius = !isStorm && config.challenge === "shrinking"
    ? arenaRadius * Math.max(0.62, 1 - (shuffleStep / Math.max(1, config.shuffles)) * 0.34)
    : arenaRadius;
  const ballCount = displayOrder.length;

  const playSfx = (player: { seekTo: (seconds: number) => void; play: () => void }) => {
    if (!soundOn) return;
    player.seekTo(0);
    player.play();
  };

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      if (!value) return;
      try {
        const parsed = JSON.parse(value) as Partial<SaveState>;
        const restored = { ...INITIAL_SAVE, ...parsed };
        setSave(restored);
        setEndGameLevel(Math.max(1, restored.campaignLevel));
        setInfiniteLevel(Math.max(1, restored.infiniteBest || 1));
        setStormLevel(Math.max(1, restored.stormBest || 1));
      } catch {
        // A malformed local save should never block a new game.
      }
    });
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((value) => {
      setAppStage(value ? "menu" : "onboarding");
    }).catch(() => setShowOnboarding(true));
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(PROFILE_KEY).then((value) => {
      if (!value) return;
      try {
        const profile = JSON.parse(value) as { username?: string; avatarId?: string; soundOn?: boolean; musicOn?: boolean; vibrationOn?: boolean; language?: Language };
        if (profile.username) setUsername(profile.username);
        if (profile.avatarId) setAvatarId(profile.avatarId);
        if (typeof profile.soundOn === "boolean") setSoundOn(profile.soundOn);
        if (typeof profile.musicOn === "boolean") setMusicOn(profile.musicOn);
        if (typeof profile.vibrationOn === "boolean") setVibrationOn(profile.vibrationOn);
        if (profile.language === "en" || profile.language === "ar") setLanguage(profile.language);
      } catch {}
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(PROFILE_KEY, JSON.stringify({ username, avatarId, soundOn, musicOn, vibrationOn, language })).catch(() => undefined);
  }, [avatarId, language, musicOn, soundOn, username, vibrationOn]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next !== "active" && (phase === "countdown" || phase === "watching" || phase === "selecting")) {
        setPhase("ready");
        setResult(null);
        setSelectedSlot(null);
        selectedSlotRef.current = null;
        setAppStage("menu");
      }
    });
    return () => subscription.remove();
  }, [phase]);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
  }, []);

  useEffect(() => {
    musicPlayer.loop = true;
    if (musicOn && (appStage === "menu" || appStage === "game")) {
      musicPlayer.play();
    } else {
      musicPlayer.pause();
    }
  }, [appStage, musicOn, musicPlayer]);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(save)).catch(() => undefined);
  }, [save]);

  useEffect(() => {
    if (phase !== "countdown") return;

    const timer = setInterval(() => {
      setCountdown((value) => {
        playSfx(value <= 1 ? goPlayer : countdownPlayer);
        if (value <= 1) {
          clearInterval(timer);
          setPhase("watching");
          setRoundStartedAt(Date.now());
          setShuffleStep(0);
          return 0;
        }
        return value - 1;
      });
    }, 820);

    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "watching") return;

    setTimeLeft(roundDuration);
    const clock = setInterval(() => {
      setTimeLeft((value) => Math.max(0, value - 1));
    }, 1000);

    const interval = isStorm ? 34 : Math.max(260, 720 / config.speed);
    const decoyTimer = config.decoys > 0 ? setInterval(() => {
      const candidates = displayOrder.map((_, index) => index).filter((index) => !redSlots.includes(index));
      if (candidates.length === 0) return;
      const slot = candidates[Math.floor(Math.random() * candidates.length)];
      setDecoySlot(slot);
      setTimeout(() => setDecoySlot(null), 150);
    }, 1800) : null;
    const timer = setInterval(() => {
      setShuffleStep((step) => {
        const nextStep = step + 1;
        if (!isStorm && config.challenge === "freeze" && nextStep % 7 === 0) return nextStep;
        if (isStorm) {
          const dt = 0.034;
          const arenaCenter = arenaSize / 2;
          const maxRadius = arenaSize / 2 - activeBallSize / 2 - 8;
          setStormPositions((positions) => {
            const next = positions.map((point, index) => {
              const velocity = stormVelocities.current[index] ?? { x: 100, y: 80 };
              let x = point.x + velocity.x * dt;
              let y = point.y + velocity.y * dt;
              const centerX = x + activeBallSize / 2;
              const centerY = y + activeBallSize / 2;
              const distance = Math.sqrt((centerX - arenaCenter) ** 2 + (centerY - arenaCenter) ** 2);
              if (distance > maxRadius) {
                const normalX = (centerX - arenaCenter) / distance;
                const normalY = (centerY - arenaCenter) / distance;
                const outwardSpeed = velocity.x * normalX + velocity.y * normalY;
                if (outwardSpeed > 0) {
                  velocity.x -= 2 * outwardSpeed * normalX;
                  velocity.y -= 2 * outwardSpeed * normalY;
                }
                x = arenaCenter + normalX * maxRadius - activeBallSize / 2;
                y = arenaCenter + normalY * maxRadius - activeBallSize / 2;
              }
              return { x, y };
            });

            if (stormConfig.level <= 5) {
              for (let first = 0; first < next.length; first += 1) {
                for (let second = first + 1; second < next.length; second += 1) {
                  const dx = (next[first].x - next[second].x);
                  const dy = (next[first].y - next[second].y);
                  if (Math.sqrt(dx * dx + dy * dy) < activeBallSize) {
                    const velocity = stormVelocities.current[first];
                    stormVelocities.current[first] = stormVelocities.current[second];
                    stormVelocities.current[second] = velocity;
                  }
                }
              }
            }
            return next;
          });
        } else {
          setDisplayOrder((order) => moveOrder(order, nextStep));
        }
        return nextStep;
      });
    }, interval);

    const endTimer = setTimeout(() => {
      clearInterval(timer);
      setTimeout(() => setPhase("selecting"), 180);
      if (vibrationOn) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    }, roundDuration * 1000 + 180);

    return () => {
      clearInterval(timer);
      clearTimeout(endTimer);
      clearInterval(clock);
      if (decoyTimer) clearInterval(decoyTimer);
      setDecoySlot(null);
    };
  }, [activeBallSize, arenaSize, config.challenge, config.decoys, config.duration, config.speed, isStorm, phase, roundDuration]);

  useEffect(() => {
    if (phase !== "countdown" && phase !== "watching") return;
    pulse.setValue(0.94);
    Animated.timing(pulse, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [countdown, phase, pulse, shuffleStep]);

  const startRound = () => {
    const nextOrder = isStorm ? createOrder(stormConfig.balls) : mode === "campaign" ? createEndGameOrder(config.balls, config.redCount, config.level) : createOrder(config.balls);
    setDisplayOrder(nextOrder);
    if (isStorm) {
      setStormPositions(createStormPositions(stormConfig.balls, arenaSize, stormConfig.ballSize));
      stormVelocities.current = createStormVelocities(stormConfig.balls, stormConfig.speed);
    }
    setCountdown(3);
    setResult(null);
    setTimeLeft(roundDuration);
    setSelectedSlot(null);
    setSelectedSlots([]);
    selectedSlotRef.current = null;
    setPhase("countdown");
    playSfx(tapPlayer);
    if (vibrationOn) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  };

  const chooseBall = (slot: number) => {
    if (phase !== "selecting" || selectedSlots.includes(slot)) return;
    selectedSlotRef.current = slot;
    setSelectedSlot(slot);

    const isCorrect = redSlots.includes(slot);
    const nextSelected = [...selectedSlots, slot];
    setSelectedSlots(nextSelected);
    if (isCorrect && nextSelected.filter((selected) => redSlots.includes(selected)).length >= redSlots.length) {
      setResult("correct");
      setPhase("result");
      playSfx(correctPlayer);
      if (vibrationOn) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);

      setSave((previous) => ({
        ...previous,
        infiniteBest:
          mode === "infinite" ? Math.max(previous.infiniteBest, currentLevel) : previous.infiniteBest,
      }));
    } else if (!isCorrect) {
      setResult("lost");
      setPhase("result");
      playSfx(wrongPlayer);
      if (vibrationOn) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    } else {
      selectedSlotRef.current = null;
      playSfx(tapPlayer);
    }
  };

  const continueAfterResult = () => {
    if (result === "correct") {
      if (isStorm) {
        setStormLevel((value) => value + 1);
        setSave((previous) => ({ ...previous, stormBest: Math.max(previous.stormBest, Math.min(stormLevel + 1, STORM_LEVEL_COUNT)) }));
      } else if (mode === "campaign") {
        const nextLevel = Math.min(endGameLevel + 1, END_GAME_LEVEL_COUNT);
        setEndGameLevel(nextLevel);
        setSave((previous) => ({ ...previous, campaignLevel: Math.max(previous.campaignLevel, nextLevel) }));
      } else {
        setInfiniteLevel((value) => value + 1);
      }
    }
    setPhase("ready");
    setResult(null);
    setSelectedSlot(null);
    selectedSlotRef.current = null;
    if (isStorm) {
      const nextStorm = result === "correct" ? Math.min(stormLevel + 1, STORM_LEVEL_COUNT) : stormLevel;
      const nextConfig = getStormConfig(nextStorm);
      setDisplayOrder(createOrder(nextConfig.balls));
      setStormPositions(createStormPositions(nextConfig.balls, arenaSize, nextConfig.ballSize));
      stormVelocities.current = createStormVelocities(nextConfig.balls, nextConfig.speed);
    } else {
      const nextFocus = mode === "campaign"
        ? getEndGameConfig(result === "correct" ? endGameLevel + 1 : endGameLevel)
        : getLevelConfig("infinite", result === "correct" ? infiniteLevel + 1 : infiniteLevel);
      setDisplayOrder(mode === "campaign" ? createEndGameOrder(nextFocus.balls, nextFocus.redCount, nextFocus.level) : createOrder(nextFocus.balls));
    }
  };

  const changeMode = (nextMode: GameMode) => {
    if (mode === nextMode) return;
    setMode(nextMode);
    setPhase("ready");
    setResult(null);
    if (gameType === "focus") {
      const nextConfig = nextMode === "campaign" ? getEndGameConfig(endGameLevel) : getLevelConfig("infinite", infiniteLevel);
      setDisplayOrder(nextMode === "campaign" ? createEndGameOrder(nextConfig.balls, nextConfig.redCount, nextConfig.level) : createOrder(nextConfig.balls));
    }
  };

  const openEndGame = () => {
    const endGame = getEndGameConfig(1);
    setMode("campaign");
    setEndGameLevel(1);
    setPhase("ready");
    setResult(null);
    setSelectedSlot(null);
    selectedSlotRef.current = null;
    setDisplayOrder(createEndGameOrder(endGame.balls, endGame.redCount, endGame.level));
  };

  const openFocusTrack = (nextMode: GameMode) => {
    const nextConfig = nextMode === "campaign" ? getEndGameConfig(endGameLevel) : getLevelConfig("infinite", infiniteLevel);
    setGameType("focus");
    setMode(nextMode);
    setDisplayOrder(nextMode === "campaign" ? createEndGameOrder(nextConfig.balls, nextConfig.redCount, nextConfig.level) : createOrder(nextConfig.balls));
    setPhase("ready");
    setResult(null);
    setSelectedSlot(null);
    setAppStage("game");
  };

  const openStorm = () => {
    const nextConfig = getStormConfig(stormLevel);
    setGameType("storm");
    setDisplayOrder(createOrder(nextConfig.balls));
    setStormPositions(createStormPositions(nextConfig.balls, arenaSize, nextConfig.ballSize));
    stormVelocities.current = createStormVelocities(nextConfig.balls, nextConfig.speed);
    setPhase("ready");
    setResult(null);
    setSelectedSlot(null);
    setAppStage("game");
  };

  const returnToMenu = () => {
    setPhase("ready");
    setResult(null);
    setSelectedSlot(null);
    selectedSlotRef.current = null;
    setAppStage("menu");
  };

  const changeGameType = (nextType: GameType) => {
    if (gameType === nextType) return;
    setGameType(nextType);
    setPhase("ready");
    setResult(null);
    setSelectedSlot(null);
    setDisplayOrder(createOrder(nextType === "storm" ? stormConfig.balls : config.balls));
    if (nextType === "storm") {
      setStormPositions(createStormPositions(stormConfig.balls, arenaSize, stormConfig.ballSize));
      stormVelocities.current = createStormVelocities(stormConfig.balls, stormConfig.speed);
    }
  };

  const finishOnboarding = () => {
    setShowOnboarding(false);
    setAppStage("menu");
    AsyncStorage.setItem(ONBOARDING_KEY, "complete").catch(() => undefined);
  };

  /** Close the app where the platform permits it; iOS intentionally does not expose a quit API. */
  const exitGame = () => {
    if (Platform.OS === "android") {
      BackHandler.exitApp();
    } else if (Platform.OS === "web") {
      window.close();
    } else {
      Alert.alert("REDX", language === "ar" ? "استخدم إيماءة الشاشة الرئيسية أو زرها لمغادرة اللعبة." : "Use your device home gesture or button to leave the game.");
    }
  };

  const openFocusBriefing = () => {
    setPendingFocusMode(null);
    setInstructionContext("focus");
  };

  const chooseFocusMode = (nextMode: GameMode) => {
    setShowFocusChoices(false);
    setPendingFocusMode(nextMode);
    setInstructionContext("focus");
  };

  const closeInstructions = () => {
    const nextMode = pendingFocusMode;
    const context = instructionContext;
    setInstructionContext(null);
    setPendingFocusMode(null);
    if (context === "focus" && nextMode) openFocusTrack(nextMode);
    if (context === "focus" && !nextMode) setShowFocusChoices(true);
    if (context === "storm") openStorm();
  };

  const titleCopy = phase === "selecting" ? t.whereRed : phase === "result" ? (result === "correct" ? t.redFound : t.redLost) : isStorm ? t.redStorm : t.watchRed;
  const subtitleCopy = phase === "selecting" ? t.tapTracked : phase === "result" ? (result === "correct" ? t.staySharp : t.replay) : isStorm ? t.trackOrigin : t.watchRed;
  const gameTitle = isStorm ? t.redStorm : mode === "campaign" ? t.endGame : t.infinite;
  const localWorldLabel = config.worldLabel === "TRAINING" ? t.training : config.worldLabel === "SPEED" ? t.speedWorld : config.worldLabel === "CHAOS" ? t.chaos : config.worldLabel === "END GAME" ? t.endWorld : config.worldLabel === "DECOY FLASH" ? t.decoy : config.worldLabel === "FREEZE RECALL" ? t.freeze : config.worldLabel === "SHRINKING ARENA" ? t.shrinking : config.worldLabel === "INFINITE" ? t.infinite : config.worldLabel;
  const localStormLabel = stormConfig.label.includes("WALL RUN") ? `${t.stormLabel} / ${t.wallRun}` : `${t.stormLabel} / ${t.collision}`;

  if (appStage === "onboarding") {
    return (
      <ScreenContainer edges={["top", "right", "bottom", "left"]} containerClassName="bg-[#07080b]">
        <View style={styles.welcomeScreen}>
          <View style={styles.welcomeBrand}><Image source={require("../../assets/images/icon.png")} style={styles.welcomeLogo} resizeMode="contain" /><Text style={styles.welcomeTag}>FOCUS LAB / 001</Text></View>
          <View style={styles.welcomeCard}>
            <View style={[styles.languageRow, rtl && styles.rtlRow]}><Text style={[styles.profileLabel, rtl && styles.rtlText]}>{t.language}</Text><View style={[styles.languageChoices, rtl && styles.rtlRow]}><Pressable onPress={() => setLanguage("en")} style={[styles.languageChoice, language === "en" && styles.languageChoiceActive]}><Text style={styles.languageText}>{t.english}</Text></Pressable><Pressable onPress={() => setLanguage("ar")} style={[styles.languageChoice, language === "ar" && styles.languageChoiceActive]}><Text style={styles.languageText}>{t.arabic}</Text></Pressable></View></View>
            <Text style={[styles.modalTitle, rtl && styles.rtlText]}>{t.profile}</Text>
            <Text style={[styles.modalCopy, rtl && styles.rtlText]}>{t.profileCopy}</Text>
            <TextInput value={rtl && username === "Guest" ? "" : username} onChangeText={setUsername} placeholder={t.yourName} placeholderTextColor="#686d77" maxLength={12} style={[styles.modalInput, rtl && styles.rtlText]} />
            <Text style={[styles.profileLabel, rtl && styles.rtlText]}>{t.chooseAvatar}</Text>
            <View style={styles.avatarGrid}>{AVATARS.map((avatar) => <Pressable key={avatar.id} onPress={() => setAvatarId(avatar.id)} style={[styles.avatarChoice, avatarId === avatar.id && styles.avatarChoiceActive]}><MaterialIcons name={avatar.icon} size={28} color={avatarId === avatar.id ? RED : "#f7f7f8"} /><Text style={styles.avatarLabel}>{avatar.label}</Text></Pressable>)}</View>
            <Pressable onPress={finishOnboarding} style={[styles.primaryButton, rtl && styles.rtlRow]}><Text style={styles.primaryButtonText}>{t.continueGuest}</Text><MaterialIcons name={rtl ? "arrow-back" : "arrow-forward"} size={18} color={BG} /></Pressable>
          </View>
        </View>
      </ScreenContainer>
    );
  }

  if (appStage === "menu") {
    const selectedAvatar = AVATARS.find((avatar) => avatar.id === avatarId) ?? AVATARS[0];
    return (
      <ScreenContainer edges={["top", "right", "bottom", "left"]} containerClassName="bg-[#07080b]">
        <ScrollView contentContainerStyle={styles.menuContent}>
          <View style={[styles.menuTopRow, rtl && styles.rtlRow]}><View style={[styles.playerChip, rtl && styles.rtlRow]}><View style={styles.avatarMini}><MaterialIcons name={selectedAvatar.icon} size={18} color={RED} /></View><Text style={[styles.playerName, rtl && styles.rtlText]}>{rtl && (!username || username === "Guest") ? "ضيف" : username || "Guest"}</Text></View><Pressable accessibilityLabel={t.settings} onPress={() => setShowProfile(true)} style={styles.iconButton}><MaterialIcons name="settings" size={20} color="#f7f7f8" /></Pressable></View>
          <View style={styles.menuHero}><Text style={styles.menuLogo}>RED<Text style={styles.brandAccent}>X</Text></Text><Text style={[styles.menuHeroTitle, rtl && styles.rtlText]}>{t.trust}</Text><Text style={[styles.menuHeroCopy, rtl && styles.rtlText]}>{t.heroCopy}</Text></View>
          <Text style={[styles.chooseMessage, rtl && styles.rtlText]}>{t.chooseArena}</Text>
          {!showFocusChoices ? <Pressable onPress={openFocusBriefing} style={[styles.menuModeCard, rtl && styles.rtlRow]}><View><Text style={[styles.menuModeTitle, rtl && styles.rtlText]}>{t.focusTrack}</Text><Text style={[styles.menuModeCopy, rtl && styles.rtlText]}>{t.focusCopy}</Text></View><MaterialIcons name={rtl ? "arrow-back" : "arrow-forward"} size={22} color={RED} /></Pressable> : <View><Pressable onPress={() => chooseFocusMode("infinite")} style={[styles.menuModeCard, rtl && styles.rtlRow]}><View><Text style={[styles.menuModeTitle, rtl && styles.rtlText]}>{t.infinite}</Text><Text style={[styles.menuModeCopy, rtl && styles.rtlText]}>{t.infiniteCopy}</Text></View><MaterialIcons name="all-inclusive" size={22} color={RED} /></Pressable><Pressable onPress={() => chooseFocusMode("campaign")} style={[styles.menuModeCard, rtl && styles.rtlRow]}><View><Text style={[styles.menuModeTitle, rtl && styles.rtlText]}>{t.endGame}</Text><Text style={[styles.menuModeCopy, rtl && styles.rtlText]}>{t.endCopy}</Text></View><MaterialIcons name={rtl ? "arrow-back" : "arrow-forward"} size={22} color={RED} /></Pressable><Pressable onPress={() => setShowFocusChoices(false)} style={styles.exitButton}><Text style={styles.exitButtonText}>{t.back}</Text></Pressable></View>}
          <Pressable onPress={() => { setInstructionContext("storm"); setPendingFocusMode(null); }} style={[styles.menuModeCard, styles.menuModeCardStorm, rtl && styles.rtlRow]}><View><Text style={[styles.menuModeTitle, rtl && styles.rtlText]}>{t.redStorm}</Text><Text style={[styles.menuModeCopy, rtl && styles.rtlText]}>{t.stormCopy}</Text></View><MaterialIcons name={rtl ? "arrow-back" : "arrow-forward"} size={22} color={RED} /></Pressable>
          <View style={[styles.menuStats, rtl && styles.rtlRow]}><Text style={[styles.menuStat, rtl && styles.rtlText]}>{t.infinite} {formatLevel(Math.max(1, infiniteLevel))}</Text><Text style={[styles.menuStat, rtl && styles.rtlText]}>{t.endGame} {formatLevel(Math.max(1, endGameLevel))}/20</Text><Text style={[styles.menuStat, rtl && styles.rtlText]}>{t.redStorm} {formatLevel(Math.max(1, stormLevel))}/20</Text></View>
          <Pressable onPress={exitGame} style={styles.exitButton}><Text style={styles.exitButtonText}>{t.exit}</Text></Pressable>
          <Text style={[styles.footerCopy, rtl && styles.rtlText]}>REDX / 1.0 · {t.staySharp}</Text>
        </ScrollView>
        {showProfile && <ProfileModal username={username} setUsername={setUsername} avatarId={avatarId} setAvatarId={setAvatarId} soundOn={soundOn} setSoundOn={setSoundOn} musicOn={musicOn} setMusicOn={setMusicOn} vibrationOn={vibrationOn} setVibrationOn={setVibrationOn} language={language} setLanguage={setLanguage} onClose={() => setShowProfile(false)} onLegal={setShowLegal} />}
        {showLegal && <LegalModal kind={showLegal} language={language} onClose={() => setShowLegal(null)} />}
        {instructionContext && <InstructionsModal context={instructionContext} focusMode={pendingFocusMode} language={language} onClose={closeInstructions} />}
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "right", "bottom", "left"]} containerClassName="bg-[#07080b]">
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.headerRow, rtl && styles.rtlRow]}>
          <Pressable accessibilityLabel={t.mainMenu} onPress={returnToMenu} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <MaterialIcons name="home" size={20} color="#f7f7f8" />
          </Pressable>
          <View style={styles.brandLockup}><Text style={[styles.gameHeaderTitle, rtl && styles.rtlText]}>{gameTitle}</Text><Text style={styles.eyebrow}>REDX / FOCUS LAB</Text></View>
          <Pressable accessibilityLabel={t.settings} onPress={() => setShowProfile(true)} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <MaterialIcons name="more-horiz" size={22} color="#f7f7f8" />
          </Pressable>
        </View>

        <View style={[styles.levelMetaRow, rtl && styles.rtlRow]}>
          <View>
            <Text style={[styles.worldKicker, rtl && styles.rtlText]}>{isStorm ? localStormLabel : `${config.world} / ${localWorldLabel}`}</Text>
            <Text style={[styles.levelTitle, rtl && styles.rtlText]}>{isStorm ? `${t.level} ${formatLevel(stormLevel)}` : mode === "infinite" ? `${t.round} ${formatLevel(currentLevel)}` : `${t.level} ${formatLevel(currentLevel)}`}</Text>
          </View>
          <Text style={[styles.levelBadge, rtl && styles.rtlText]}>{isStorm ? `${t.stormLabel} ${formatLevel(stormLevel)}` : mode === "infinite" ? t.endless : t.focus}</Text>
        </View>

        <View style={[styles.instructionRow, rtl && styles.rtlRow]}>
          <View style={styles.instructionDot} />
          <Text style={[styles.instructionText, rtl && styles.rtlText]}>{subtitleCopy}</Text>
          <Text style={[styles.shuffleCount, rtl && styles.rtlText]}>{isStorm ? `${stormConfig.duration} ${t.seconds} ${t.stormLabel}` : config.challenge === "standard" ? `${config.shuffles} ${t.shuffles}` : localWorldLabel}</Text>
        </View>

        <View style={styles.arenaStage}>
        <Animated.View style={[styles.arena, { width: arenaSize, height: arenaSize, transform: [{ scale: pulse }] }]}>
          <View style={styles.arenaInner} />
          <View style={[styles.arenaGlow, { width: arenaSize * 0.7, height: arenaSize * 0.7, borderRadius: arenaSize * 0.35 }]} />
          {displayOrder.map((ballId, slot) => {
            const angle = (slot / ballCount) * Math.PI * 2 - Math.PI / 2;
            const stormPosition = stormPositions[slot];
            const x = isStorm && stormPosition ? stormPosition.x : arenaSize / 2 + Math.cos(angle) * focusRadius - activeBallSize / 2;
            const y = isStorm && stormPosition ? stormPosition.y : arenaSize / 2 + Math.sin(angle) * focusRadius - activeBallSize / 2;
            const isRed = ballId < (isStorm ? 1 : config.redCount);
            const isDecoy = !isRed && decoySlot === slot && phase === "watching";
            const isSelected = selectedSlots.includes(slot);
            const showRed = isRed && phase !== "selecting" && phase !== "result";
            const showStormCue = isStorm && phase === "ready";
            const showResultState = phase === "result" && (isSelected || isRed);

            return (
              <Pressable
                key={`${ballId}-${slot}`}
                accessibilityLabel={rtl ? `الكرة ${ballId + 1}` : `Ball ${ballId + 1}`}
                onPress={() => chooseBall(slot)}
                style={({ pressed }) => [
                  [styles.ball, { width: activeBallSize, height: activeBallSize, borderRadius: activeBallSize / 2 }],
                  { left: x, top: y, backgroundColor: isStorm ? (showStormCue ? (isRed ? RED : BLUE) : RED) : (isDecoy || showRed || (showResultState && isRed && result === "lost") ? RED : BLUE) },
                  (isStorm && phase !== "ready" && phase !== "countdown" ? styles.stormBall : null),
                  (isStorm && phase !== "ready" && phase !== "countdown" && phase !== "result" ? styles.stormMovingBall : null),
                  isSelected && (result === "correct" ? styles.correctBall : styles.wrongBall),
                  showResultState && isRed && result === "correct" && styles.correctBall,
                  showResultState && isRed && result === "lost" && styles.correctBall,
                  pressed && styles.ballPressed,
                ]}
              >
                {showStormCue && isRed && <View style={styles.stormTargetCue} />}
                {isDecoy && <View style={styles.decoyFlash} />}
                {showResultState && isRed && result === "lost" && <View style={styles.redReveal} />}
              </Pressable>
            );
          })}

          {phase === "ready" && (
            <View style={styles.centerPrompt}>
              <Text style={[styles.centerPromptTitle, rtl && styles.rtlText]}>{t.dontLose}</Text>
              <Text style={[styles.centerPromptAccent, rtl && styles.rtlText]}>{t.redBall}</Text>
              <Text style={[styles.centerPromptHint, rtl && styles.rtlText]}>{t.yourFocus}</Text>
            </View>
          )}
          {phase === "countdown" && (
            <View style={styles.centerPrompt}>
              <Text style={[styles.countdownLabel, rtl && styles.rtlText]}>{t.getReady}</Text>
              <Text style={styles.countdownNumber}>{countdown}</Text>
            </View>
          )}
          {phase === "watching" && (
            <View style={styles.centerPrompt} pointerEvents="none">
              <Text style={[styles.watchLabel, rtl && styles.rtlText]}>{t.follow}</Text>
              <View style={styles.watchChevron} />
            </View>
          )}
          {phase === "selecting" && (
            <View style={styles.centerPrompt} pointerEvents="none">
              <Text style={[styles.selectLabel, rtl && styles.rtlText]}>{redSlots.length > 1 ? `${t.tapReds} ${redSlots.length}` : t.tapOne}</Text>
              <Text style={[styles.selectQuestion, rtl && styles.rtlText]}>{redSlots.length > 1 ? t.tapReds : t.redQuestion}</Text>
            </View>
          )}
          {phase === "result" && (
            <View style={styles.centerPrompt} pointerEvents="none">
              <Text style={[styles.resultMark, result === "correct" ? styles.correctText : styles.lostText]}>{result === "correct" ? "✓" : "×"}</Text>
              <Text style={styles.resultSmall}>{result === "correct" ? t.correct : t.missed}</Text>
            </View>
          )}
        </Animated.View>
        </View>

          <View style={[styles.statusRow, rtl && styles.rtlRow]}>
          <View>
            <Text style={[styles.statusEyebrow, rtl && styles.rtlText]}>{titleCopy}</Text>
            <Text style={[styles.statusSub, rtl && styles.rtlText]}>{phase === "watching" ? `${timeLeft} ${t.seconds}` : phase === "selecting" ? t.tapTracked : phase === "result" ? (result === "correct" ? t.correct : t.replay) : `${isStorm ? stormConfig.balls : config.balls} ${t.balls}`}</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${isStorm ? Math.min(100, ((roundDuration - timeLeft) / Math.max(1, roundDuration)) * 100) : Math.min(100, (shuffleStep / Math.max(1, config.shuffles)) * 100)}%` }]} />
          </View>
        </View>

        {phase === "result" ? (
          <View style={[styles.resultCard, result === "correct" ? styles.resultCardSuccess : styles.resultCardLost]}>
            <View>
              <Text style={[styles.resultCardTitle, rtl && styles.rtlText]}>{result === "correct" ? t.correct : t.redLost}</Text>
              <Text style={[styles.resultCardCopy, rtl && styles.rtlText]}>{result === "correct" ? t.staySharp : t.replay}</Text>
            </View>
            <Pressable onPress={continueAfterResult} style={({ pressed }) => [styles.primaryButton, rtl && styles.rtlRow, pressed && styles.primaryButtonPressed]}>
              <Text style={styles.primaryButtonText}>{result === "correct" ? t.nextRound : t.replay}</Text>
              <MaterialIcons name={rtl ? "arrow-back" : "arrow-forward"} size={18} color={BG} />
            </Pressable>
            <Pressable onPress={returnToMenu} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{t.mainMenu}</Text></Pressable>
          </View>
        ) : (
          <Pressable onPress={startRound} disabled={phase !== "ready"} style={({ pressed }) => [styles.primaryButton, rtl && styles.rtlRow, phase !== "ready" && styles.buttonDisabled, pressed && styles.primaryButtonPressed]}>
            <Text style={styles.primaryButtonText}>{phase === "ready" ? t.startRound : phase === "selecting" ? t.whereRed : `${t.focus}...`}</Text>
            <MaterialIcons name={phase === "ready" ? "play-arrow" : "visibility"} size={19} color={BG} />
          </Pressable>
        )}

        <View style={[styles.footerRow, rtl && styles.rtlRow]}>
          <Text style={[styles.footerCopy, rtl && styles.rtlText]}>{t.staySharp}</Text>
          <Text style={styles.footerVersion}>REDX / 1.0</Text>
        </View>
      </ScrollView>

      {showOnboarding && (
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Image source={require("../../assets/images/icon.png")} style={styles.onboardingLogo} resizeMode="contain" />
            <Text style={[styles.modalTitle, rtl && styles.rtlText]}>{t.trackRedTitle}</Text>
            <Text style={[styles.modalCopy, rtl && styles.rtlText]}>{t.trackRedCopy}</Text>
            <TextInput value={username} onChangeText={setUsername} placeholder={t.enterName} placeholderTextColor="#686d77" maxLength={12} style={[styles.modalInput, rtl && styles.rtlText]} />
            <Pressable onPress={finishOnboarding} style={[styles.primaryButton, rtl && styles.rtlRow]}><Text style={styles.primaryButtonText}>{t.startGuest}</Text><MaterialIcons name={rtl ? "arrow-back" : "arrow-forward"} size={18} color={BG} /></Pressable>
          </View>
        </View>
      )}

      {showProfile && (
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={[styles.modalHeader, rtl && styles.rtlRow]}>
              <Text style={[styles.modalTitle, rtl && styles.rtlText]}>{t.settings}</Text>
              <Pressable accessibilityLabel={t.close} onPress={() => setShowProfile(false)} style={styles.modalClose}><MaterialIcons name="close" size={20} color="#f7f7f8" /></Pressable>
            </View>
            <Text style={[styles.profileLabel, rtl && styles.rtlText]}>{t.playerName}</Text>
            <TextInput value={rtl && username === "Guest" ? "" : username} onChangeText={setUsername} placeholder={t.yourName} placeholderTextColor="#686d77" maxLength={12} style={[styles.modalInput, rtl && styles.rtlText]} />
            <View style={[styles.settingsRow, rtl && styles.rtlRow]}><Text style={[styles.ruleText, rtl && styles.rtlText]}>{t.sound}</Text><Pressable onPress={() => setSoundOn((value) => !value)} style={[styles.toggle, soundOn && styles.toggleActive]}><Text style={styles.toggleText}>{soundOn ? t.on : t.off}</Text></Pressable></View>
            <View style={[styles.settingsRow, rtl && styles.rtlRow]}><Text style={[styles.ruleText, rtl && styles.rtlText]}>{t.music}</Text><Pressable onPress={() => setMusicOn((value) => !value)} style={[styles.toggle, musicOn && styles.toggleActive]}><Text style={styles.toggleText}>{musicOn ? t.on : t.off}</Text></Pressable></View>
            <Pressable onPress={() => setShowProfile(false)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{t.done}</Text></Pressable>
          </View>
        </View>
      )}

      {showGuide && (
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={[styles.modalHeader, rtl && styles.rtlRow]}>
              <Text style={[styles.modalTitle, rtl && styles.rtlText]}>{t.howToPlay}</Text>
              <Pressable accessibilityLabel={t.close} onPress={() => setShowGuide(false)} style={styles.modalClose}><MaterialIcons name="close" size={20} color="#f7f7f8" /></Pressable>
            </View>
            <Text style={[styles.modalCopy, rtl && styles.rtlText]}>{isStorm ? (language === "ar" ? `اعثر على الكرة الأصلية قبل بدء العاصفة. تتحول كل كرة إلى اللون الأحمر، ثم يتحرك المجال لمدة ${stormConfig.duration} ثانية. تتبّع الكرة حتى يصل المؤقت إلى الصفر.` : `Find the origin ball before the storm starts. Every ball turns red, then the field moves for ${stormConfig.duration} seconds. Track it until the timer reaches zero.`) : (language === "ar" ? "حافظ على تركيز بصرك على الكرة الحمراء أثناء تبدّل المدارات. عندما تتوقف الساحة، اضغط على الكرة التي تتبعتها." : "Keep your eyes on the red ball while the orbit shuffles. When the arena stops, tap the ball you tracked.")}</Text>
            <View style={[styles.ruleRow, rtl && styles.rtlRow]}><Text style={styles.ruleNumber}>01</Text><Text style={[styles.ruleText, rtl && styles.rtlText]}>{isStorm ? (language === "ar" ? "احفظ موقع الكرة الحمراء الأصلية." : "Memorize the origin ball.") : (language === "ar" ? "راقب الكرة الحمراء." : "Watch the red ball.")}</Text></View>
            <View style={[styles.ruleRow, rtl && styles.rtlRow]}><Text style={styles.ruleNumber}>02</Text><Text style={[styles.ruleText, rtl && styles.rtlText]}>{isStorm ? (language === "ar" ? "تجاوز فوضى العاصفة." : "Survive the storm chaos.") : (language === "ar" ? "انتظر توقف الساحة." : "Wait for the arena to stop.")}</Text></View>
            <View style={[styles.ruleRow, rtl && styles.rtlRow]}><Text style={styles.ruleNumber}>03</Text><Text style={[styles.ruleText, rtl && styles.rtlText]}>{language === "ar" ? "اضغط على موضعها النهائي." : "Tap its final position."}</Text></View>
            <Pressable onPress={() => setShowGuide(false)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{t.gotIt}</Text></Pressable>
          </View>
        </View>
      )}

      {showLevels && (
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={[styles.modalHeader, rtl && styles.rtlRow]}>
              <Text style={[styles.modalTitle, rtl && styles.rtlText]}>{t.levelMap}</Text>
              <Pressable accessibilityLabel={t.close} onPress={() => setShowLevels(false)} style={styles.modalClose}><MaterialIcons name="close" size={20} color="#f7f7f8" /></Pressable>
            </View>
            <Text style={[styles.modalCopy, rtl && styles.rtlText]}>{t.levelMapCopy}</Text>
            <View style={[styles.worldMapRow, rtl && styles.rtlRow]}><Text style={styles.mapWorldActive}>∞</Text><Text style={[styles.mapWorldName, rtl && styles.rtlText]}>{t.infinite}</Text><Text style={[styles.mapWorldState, rtl && styles.rtlText]}>{t.endless}</Text></View>
            <View style={[styles.worldMapRow, rtl && styles.rtlRow]}><Text style={styles.mapWorld}>01–10</Text><Text style={[styles.mapWorldName, rtl && styles.rtlText]}>{t.endGame}</Text><Text style={[styles.mapWorldState, rtl && styles.rtlText]}>{t.twoReds}</Text></View>
            <Pressable onPress={() => setShowLevels(false)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{t.closeMap}</Text></Pressable>
          </View>
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  welcomeScreen: { flex: 1, justifyContent: "space-between", padding: 20, paddingTop: 72, paddingBottom: 30 },
  welcomeBrand: { alignItems: "center" },
  welcomeLogo: { width: 270, height: 170 },
  welcomeBrandText: { color: "#f7f7f8", fontSize: 52, fontWeight: "900", letterSpacing: 10 },
  welcomeTag: { color: "#686d77", fontSize: 9, fontWeight: "900", letterSpacing: 3, marginTop: 8 },
  welcomeCard: { backgroundColor: "#15171d", borderWidth: 1, borderColor: "#30343e", borderRadius: 24, padding: 20 },
  languageRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  languageChoices: { flexDirection: "row", gap: 6 },
  languageChoice: { minWidth: 72, minHeight: 32, borderRadius: 10, borderWidth: 1, borderColor: "#30343d", backgroundColor: "#0b0d11", alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  languageChoiceActive: { borderColor: RED, backgroundColor: "#251619" },
  languageText: { color: "#f7f7f8", fontSize: 10, fontWeight: "800" },
  rtlText: { textAlign: "right", writingDirection: "rtl", letterSpacing: 0, flexShrink: 1 },
  rtlRow: { flexDirection: "row-reverse" },
  menuContent: { flexGrow: 1, padding: 20, paddingTop: 18, paddingBottom: 30 },
  menuTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  playerChip: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatarMini: { width: 34, height: 34, borderRadius: 12, backgroundColor: "#181a21", borderWidth: 1, borderColor: "#6f2526", alignItems: "center", justifyContent: "center" },
  playerName: { color: "#f7f7f8", fontSize: 13, fontWeight: "800", letterSpacing: 0.5 },
  menuHero: { alignItems: "center", paddingTop: 88, paddingBottom: 60 },
  menuLogo: { color: "#f7f7f8", fontSize: 62, fontWeight: "900", letterSpacing: 12 },
  menuHeroTitle: { color: RED, fontSize: 13, fontWeight: "900", letterSpacing: 3, marginTop: 18 },
  menuHeroCopy: { color: "#838894", fontSize: 12, lineHeight: 18, textAlign: "center", maxWidth: 270, marginTop: 14 },
  menuModeCard: { minHeight: 78, borderRadius: 18, borderWidth: 1, borderColor: "#6f2526", backgroundColor: "#151116", paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  menuModeCardStorm: { borderColor: "#244d73", backgroundColor: "#10161d" },
  menuModeTitle: { color: "#f7f7f8", fontSize: 15, fontWeight: "900", letterSpacing: 1.2, flexShrink: 1 },
  menuModeCopy: { color: "#777d88", fontSize: 10, marginTop: 6, letterSpacing: 0.4, flexShrink: 1 },
  chooseMessage: { color: "#b3b7c0", fontSize: 11, fontWeight: "900", letterSpacing: 1, textAlign: "center", marginTop: 20, marginBottom: 2 },
  menuStats: { flexDirection: "row", justifyContent: "space-between", marginTop: 18 },
  menuStat: { color: "#686d77", fontSize: 8, fontWeight: "900", letterSpacing: 0.7 },
  exitButton: { alignItems: "center", paddingVertical: 16 },
  exitButtonText: { color: "#686d77", fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  avatarGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  avatarChoice: { width: 49, height: 49, borderRadius: 15, backgroundColor: "#0b0d11", borderWidth: 1, borderColor: "#30343d", alignItems: "center", justifyContent: "center" },
  avatarChoiceActive: { borderColor: RED, backgroundColor: "#251619" },
  avatarLabel: { color: "#686d77", fontSize: 7, fontWeight: "900", marginTop: 1 },
  linkButton: { paddingVertical: 11, borderTopWidth: 1, borderTopColor: "#292c34" },
  linkText: { color: "#ff9f98", fontSize: 12, fontWeight: "800" },
  legalText: { color: "#b3b7c0", fontSize: 13, lineHeight: 21, marginTop: 16 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 24 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconButton: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#15171d", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#242731" },
  pressed: { opacity: 0.6, transform: [{ scale: 0.96 }] },
  brandLockup: { alignItems: "center" },
  brand: { color: "#f7f7f8", fontSize: 28, lineHeight: 30, fontWeight: "900", letterSpacing: 5 },
  gameHeaderTitle: { color: "#f7f7f8", fontSize: 16, fontWeight: "900", letterSpacing: 2.2 },
  brandAccent: { color: RED },
  eyebrow: { marginTop: 3, color: "#60646f", fontSize: 8, fontWeight: "800", letterSpacing: 2.4 },
  sectionLabel: { color: "#5f6470", fontSize: 8, fontWeight: "900", letterSpacing: 1.4, marginTop: 18, marginBottom: 7 },
  modeRow: { marginTop: 24, flexDirection: "row", gap: 8 },
  modePill: { flex: 1, minHeight: 42, borderRadius: 12, backgroundColor: "#101217", borderWidth: 1, borderColor: "#20232b", paddingHorizontal: 12, justifyContent: "center" },
  modePillActive: { backgroundColor: "#1a1618", borderColor: "#6f2526" },
  modePillStormActive: { backgroundColor: "#231417", borderColor: RED },
  modeText: { color: "#656a76", fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  modeTextActive: { color: "#ffddd9" },
  modeTextStormActive: { color: "#ffb8b2" },
  modeBest: { color: "#686d77", fontSize: 8, fontWeight: "700", letterSpacing: 0.7, marginTop: 2 },
  progressModeRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 15 },
  levelMetaRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 25 },
  worldKicker: { color: RED, fontSize: 11, fontWeight: "900", letterSpacing: 1.6 },
  levelTitle: { color: "#f7f7f8", fontSize: 29, fontWeight: "900", letterSpacing: 1, marginTop: 3 },
  levelBadge: { color: "#686d77", fontSize: 10, fontWeight: "900", letterSpacing: 1.1, paddingBottom: 5 },
  instructionRow: { flexDirection: "row", alignItems: "center", marginTop: 14, gap: 8 },
  instructionDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: RED },
  instructionText: { color: "#c1c3c9", fontSize: 12, fontWeight: "600", flex: 1 },
  shuffleCount: { color: "#686d77", fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  arenaStage: { flex: 1, minHeight: 360, alignItems: "center", justifyContent: "center" },
  arena: { alignSelf: "center", marginTop: 0, borderRadius: 999, borderWidth: 1.5, borderColor: "#60636b", backgroundColor: "#0b0d11", position: "relative", overflow: "hidden" },
  arenaInner: { position: "absolute", left: "8%", top: "8%", width: "84%", height: "84%", borderRadius: 999, borderWidth: 1, borderColor: "#252832" },
  arenaGlow: { position: "absolute", left: "15%", top: "15%", backgroundColor: "#10141b", opacity: 0.72 },
  ball: { position: "absolute", width: BALL_SIZE, height: BALL_SIZE, borderRadius: BALL_SIZE / 2, alignItems: "center", justifyContent: "center", shadowColor: BLUE, shadowOpacity: 0.38, shadowRadius: 9, shadowOffset: { width: 0, height: 2 }, elevation: 5 },
  ballNumber: { color: "#07101a", fontSize: 12, fontWeight: "900" },
  stormBall: { shadowColor: RED, shadowOpacity: 0.52, shadowRadius: 10 },
  stormMovingBall: { borderWidth: 1, borderColor: "#ff827a" },
  stormTargetCue: { position: "absolute", width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: "#fff4f2", opacity: 0.92 },
  decoyFlash: { position: "absolute", width: 10, height: 10, borderRadius: 5, backgroundColor: "#fff4f2", opacity: 0.92 },
  ballPressed: { transform: [{ scale: 0.88 }], opacity: 0.8 },
  correctBall: { borderWidth: 3, borderColor: "#fff4f2", shadowColor: RED, shadowOpacity: 0.9, shadowRadius: 15 },
  wrongBall: { borderWidth: 3, borderColor: RED },
  redReveal: { position: "absolute", width: 9, height: 9, borderRadius: 5, backgroundColor: "#ffd4cf" },
  centerPrompt: { position: "absolute", alignSelf: "center", top: "39%", alignItems: "center", justifyContent: "center" },
  centerPromptTitle: { color: "#f7f7f8", fontSize: 12, fontWeight: "900", letterSpacing: 1.4 },
  centerPromptAccent: { color: RED, fontSize: 21, fontWeight: "900", letterSpacing: 2, marginTop: 1 },
  centerPromptHint: { color: "#686d77", fontSize: 10, fontWeight: "700", marginTop: 7, letterSpacing: 0.4 },
  countdownLabel: { color: "#a9adb6", fontSize: 10, fontWeight: "900", letterSpacing: 2.2 },
  countdownNumber: { color: "#f7f7f8", fontSize: 78, lineHeight: 84, fontWeight: "900", marginTop: -3 },
  watchLabel: { color: "#f7f7f8", fontSize: 10, fontWeight: "900", letterSpacing: 1.4, opacity: 0.72 },
  watchChevron: { marginTop: 8, width: 1, height: 22, backgroundColor: "#f7f7f8", opacity: 0.7 },
  selectLabel: { color: RED, fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  selectQuestion: { color: "#f7f7f8", fontSize: 25, fontWeight: "900", letterSpacing: 2, marginTop: 1 },
  resultMark: { fontSize: 56, lineHeight: 60, fontWeight: "800" },
  correctText: { color: "#b9f6d0" },
  lostText: { color: RED },
  resultSmall: { color: "#f7f7f8", fontSize: 10, fontWeight: "900", letterSpacing: 2, marginTop: 1 },
  statusRow: { marginTop: 17, minHeight: 44, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  statusEyebrow: { color: "#f7f7f8", fontSize: 13, fontWeight: "900", letterSpacing: 1.3 },
  statusSub: { color: "#686d77", fontSize: 9, fontWeight: "800", letterSpacing: 0.8, marginTop: 5 },
  progressTrack: { width: 74, height: 3, borderRadius: 2, backgroundColor: "#242731", overflow: "hidden", marginBottom: 5 },
  progressFill: { height: 3, borderRadius: 2, backgroundColor: RED },
  primaryButton: { minHeight: 54, borderRadius: 16, backgroundColor: "#f7f7f8", marginTop: 18, paddingHorizontal: 19, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  primaryButtonPressed: { transform: [{ scale: 0.98 }], opacity: 0.88 },
  primaryButtonText: { color: BG, fontSize: 13, fontWeight: "900", letterSpacing: 1.2 },
  buttonDisabled: { backgroundColor: "#272a31" },
  resultCard: { marginTop: 18, minHeight: 92, borderRadius: 16, borderWidth: 1, padding: 15, flexDirection: "column", alignItems: "stretch", justifyContent: "center", gap: 2 },
  resultCardSuccess: { backgroundColor: "#10221a", borderColor: "#214c35" },
  resultCardLost: { backgroundColor: "#241416", borderColor: "#5d2429" },
  resultCardTitle: { color: "#f7f7f8", fontSize: 14, fontWeight: "900", letterSpacing: 0.6 },
  resultCardCopy: { color: "#a7adb5", fontSize: 10, marginTop: 5, maxWidth: 300 },
  footerRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 24, paddingBottom: Platform.OS === "web" ? 0 : 3 },
  footerCopy: { color: "#4f535d", fontSize: 8, fontWeight: "900", letterSpacing: 1.1 },
  footerVersion: { color: "#4f535d", fontSize: 8, fontWeight: "800", letterSpacing: 1 },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.78)", justifyContent: "flex-end", padding: 16 },
  modalCard: { backgroundColor: "#15171d", borderRadius: 22, borderWidth: 1, borderColor: "#30343e", padding: 20, paddingBottom: 22 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  modalTitle: { color: "#f7f7f8", fontSize: 16, fontWeight: "900", letterSpacing: 1.2, flexShrink: 1 },
  instructionTag: { color: RED, fontSize: 8, fontWeight: "900", letterSpacing: 1.5, marginTop: 6 },
  onboardingLogo: { width: 220, height: 140, alignSelf: "center", marginBottom: 18 },
  modalClose: { width: 34, height: 34, borderRadius: 12, backgroundColor: "#23262e", alignItems: "center", justifyContent: "center" },
  modalCopy: { color: "#b3b7c0", fontSize: 13, lineHeight: 22, marginTop: 16, flexShrink: 1 },
  modalInput: { marginTop: 16, minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: "#30343d", backgroundColor: "#0b0d11", color: "#f7f7f8", paddingHorizontal: 14, fontSize: 14 },
  profileLabel: { color: "#686d77", fontSize: 9, fontWeight: "900", letterSpacing: 1.2, marginTop: 18 },
  settingsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderTopWidth: 1, borderTopColor: "#292c34", paddingVertical: 14, marginTop: 12 },
  toggle: { minWidth: 52, minHeight: 30, borderRadius: 15, backgroundColor: "#2a2d35", alignItems: "center", justifyContent: "center" },
  toggleActive: { backgroundColor: RED },
  toggleText: { color: "#f7f7f8", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  settingsValue: { color: "#686d77", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  ruleRow: { flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: "#292c34", paddingVertical: 13 },
  ruleNumber: { color: RED, fontSize: 10, fontWeight: "900", letterSpacing: 1, width: 35 },
  ruleText: { color: "#f7f7f8", fontSize: 13, fontWeight: "700", flexShrink: 1, flex: 1 },
  secondaryButton: { minHeight: 48, marginTop: 9, borderRadius: 14, backgroundColor: "#242730", alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { color: "#f7f7f8", fontSize: 12, fontWeight: "900", letterSpacing: 1.1 },
  worldMapRow: { flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: "#292c34", paddingVertical: 14 },
  mapWorldActive: { color: RED, fontSize: 12, fontWeight: "900", width: 42 },
  mapWorld: { color: "#777c87", fontSize: 12, fontWeight: "900", width: 42 },
  mapWorldName: { color: "#f7f7f8", fontSize: 12, fontWeight: "800", letterSpacing: 1.1, flex: 1 },
  mapWorldState: { color: "#686d77", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
});
