import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { Leaf, Sparkles } from "lucide-react";

export default function HeroIllustration({ firstLine, secondLine }) {
  const reduceMotion = useReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const springX = useSpring(pointerX, { stiffness: 80, damping: 22, mass: 0.55 });
  const springY = useSpring(pointerY, { stiffness: 80, damping: 22, mass: 0.55 });

  const sphereX = useTransform(springX, [-1, 1], [-5, 5]);
  const sphereY = useTransform(springY, [-1, 1], [-4, 4]);
  const outerRingX = useTransform(springX, [-1, 1], [3, -3]);
  const outerRingY = useTransform(springY, [-1, 1], [2, -2]);
  const innerRingX = useTransform(springX, [-1, 1], [-4, 4]);
  const innerRingY = useTransform(springY, [-1, 1], [-3, 3]);
  const frontLeafX = useTransform(springX, [-1, 1], [-7, 7]);
  const frontLeafY = useTransform(springY, [-1, 1], [-5, 5]);
  const backLeafX = useTransform(springX, [-1, 1], [6, -6]);
  const backLeafY = useTransform(springY, [-1, 1], [4, -4]);
  const sparkleX = useTransform(springX, [-1, 1], [8, -8]);
  const sparkleY = useTransform(springY, [-1, 1], [-6, 6]);

  const handlePointerMove = (event) => {
    if (reduceMotion || event.pointerType === "touch") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    pointerX.set(((event.clientX - bounds.left) / bounds.width - 0.5) * 2);
    pointerY.set(((event.clientY - bounds.top) / bounds.height - 0.5) * 2);
  };

  const resetParallax = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  return (
    <div
      className={`welcome-art${reduceMotion ? " is-static" : ""}`}
      aria-hidden="true"
      onPointerMove={handlePointerMove}
      onPointerLeave={resetParallax}
    >
      <div className="art-aura" />
      <motion.div className="art-circle art-circle-two" style={{ x: outerRingX, y: outerRingY }} />
      <motion.div className="art-circle art-circle-one" style={{ x: innerRingX, y: innerRingY }} />
      <motion.div className="art-sun" style={{ x: sphereX, y: sphereY }} />
      <div className="art-trail trail-one" />
      <div className="art-trail trail-two" />
      <motion.div className="art-leaf leaf-one" style={{ x: frontLeafX, y: frontLeafY }}>
        <Leaf size={34} />
      </motion.div>
      <motion.div className="art-leaf leaf-two" style={{ x: backLeafX, y: backLeafY }}>
        <Leaf size={25} />
      </motion.div>
      <span className="art-particle particle-one" />
      <span className="art-particle particle-two" />
      <span className="art-particle particle-three" />
      <span className="art-particle particle-four" />
      <span className="art-sparkle-mini sparkle-one" />
      <span className="art-sparkle-mini sparkle-two" />
      <motion.div className="art-sparkle" style={{ x: sparkleX, y: sparkleY }}>
        <Sparkles size={20} />
      </motion.div>
      <motion.span
        className="art-caption"
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.9, delay: reduceMotion ? 0 : 0.35, ease: "easeOut" }}
      >
        {firstLine}<br />{secondLine}
      </motion.span>
    </div>
  );
}
