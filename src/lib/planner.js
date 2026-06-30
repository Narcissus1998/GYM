export const bodyTypes = {
  endo: {
    label: "内胚",
    active: { carbs: 2, protein: 1.2, fat: 0.6 },
    reference: { carbs: 2, protein: 1.2, fat: 0.8 },
  },
  meso: {
    label: "中胚",
    active: { carbs: 2.5, protein: 1.4, fat: 0.7 },
    reference: { carbs: 2.5, protein: 1.2, fat: 0.9 },
  },
  ecto: {
    label: "外胚",
    active: { carbs: 3, protein: 1.6, fat: 0.8 },
    reference: { carbs: 3, protein: 1.2, fat: 1 },
  },
};

export const dayTypes = {
  high: { label: "高碳", short: "高" },
  medium: { label: "中碳", short: "中" },
  low: { label: "低碳", short: "低" },
};

export const weekdayLabels = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
export const defaultSchedule = ["medium", "high", "low", "medium", "high", "low", "medium"];

export const mealSlots = [
  { id: "breakfast", label: "早餐", ratio: 0.25 },
  { id: "lunch", label: "午餐", ratio: 0.35 },
  { id: "training", label: "训练前后", ratio: 0.15 },
  { id: "dinner", label: "晚餐", ratio: 0.25 },
];

export const calorieFactors = {
  carbs: 4,
  protein: 4,
  fat: 9,
};

export function round(value, digits = 1) {
  return Number(value.toFixed(digits));
}

export function formatNumber(value, digits = 1) {
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatCalories(value) {
  return `${Math.round(value).toLocaleString("zh-CN")} kcal`;
}

export function calculateBmr({ height, weight, age, sex }) {
  return sex === "female"
    ? 10 * weight + 6.25 * height - 5 * age - 161
    : 10 * weight + 6.25 * height - 5 * age + 5;
}

export function calculateCalories(macros) {
  return (
    macros.carbs * calorieFactors.carbs +
    macros.protein * calorieFactors.protein +
    macros.fat * calorieFactors.fat
  );
}

export function multiplyMacros(macros, factor) {
  return {
    carbs: macros.carbs * factor,
    protein: macros.protein * factor,
    fat: macros.fat * factor,
  };
}

export function calculateTemplates(weeklyTargets, dailyProtein) {
  return {
    high: {
      carbs: weeklyTargets.carbs * 0.5 / 2,
      protein: dailyProtein,
      fat: weeklyTargets.fat * 0.2 / 2,
    },
    medium: {
      carbs: weeklyTargets.carbs * 0.35 / 3,
      protein: dailyProtein,
      fat: weeklyTargets.fat * 0.35 / 3,
    },
    low: {
      carbs: weeklyTargets.carbs * 0.15 / 2,
      protein: dailyProtein,
      fat: weeklyTargets.fat * 0.45 / 2,
    },
  };
}

export function calculateStrategy(inputs, mode = "active") {
  const bodyType = bodyTypes[inputs.bodyType];
  const coefficients = bodyType[mode];
  const bmr = calculateBmr(inputs);
  const trainingBurn = inputs.trainingMinutes * inputs.trainingFactor;
  const dailyExpenditure = bmr + trainingBurn;
  const dailyTargets = multiplyMacros(coefficients, inputs.weight);
  const weeklyTargets = multiplyMacros(dailyTargets, 7);
  const templates = calculateTemplates(weeklyTargets, dailyTargets.protein);

  return {
    coefficients,
    bmr,
    trainingBurn,
    dailyExpenditure,
    dailyTargets,
    weeklyTargets,
    templates,
  };
}

export function countSchedule(schedule) {
  return schedule.reduce(
    (acc, current) => {
      acc[current] += 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0 },
  );
}

export function calculateScheduledTotals(schedule, templates) {
  return schedule.reduce(
    (acc, type) => {
      acc.carbs += templates[type].carbs;
      acc.protein += templates[type].protein;
      acc.fat += templates[type].fat;
      acc.calories += calculateCalories(templates[type]);
      return acc;
    },
    { carbs: 0, protein: 0, fat: 0, calories: 0 },
  );
}

export function calculateMacroDiff(targets, actuals) {
  return {
    carbs: actuals.carbs - targets.carbs,
    protein: actuals.protein - targets.protein,
    fat: actuals.fat - targets.fat,
    calories: actuals.calories - calculateCalories(targets),
  };
}

export function buildMealPlan(template, foodsBySlot) {
  return mealSlots.map((slot) => {
    const target = {
      carbs: template.carbs * slot.ratio,
      protein: template.protein * slot.ratio,
      fat: template.fat * slot.ratio,
    };
    const foods = foodsBySlot[slot.id] ?? [];
    const actual = foods.reduce(
      (acc, food) => {
        acc.carbs += food.carbs * food.servings;
        acc.protein += food.protein * food.servings;
        acc.fat += food.fat * food.servings;
        acc.calories += food.calories * food.servings;
        return acc;
      },
      { carbs: 0, protein: 0, fat: 0, calories: 0 },
    );

    return {
      ...slot,
      target,
      actual,
      diff: calculateMacroDiff(target, actual),
      foods,
    };
  });
}

export function exportPlan({ inputs, schedule, strategy, mealPlan, planName }) {
  const payload = {
    planName,
    exportedAt: new Date().toISOString(),
    inputs,
    schedule,
    strategy,
    mealPlan,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${planName || "carb-cycle-plan"}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
