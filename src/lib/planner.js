import { foodLibrary } from "../data/foods";

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

export const intensityOptions = [
  { id: "low-medium", label: "低-中强度", factor: 6 },
  { id: "medium-high", label: "中-高强度", factor: 8 },
  { id: "high-volume", label: "大强度/大容量", factor: 10 },
];

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
  if (!(height > 0 && weight > 0 && age > 0)) {
    return 0;
  }

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
  const trainingBurn = (inputs.trainingMinutes || 0) * (inputs.trainingFactor || 0);
  const dailyExpenditure = bmr + trainingBurn;
  const dailyTargets = multiplyMacros(coefficients, inputs.weight || 0);
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

function pickFoods(category, sortBy) {
  return [...foodLibrary].filter((food) => food.category === category).sort(sortBy);
}

function buildServing(food, byMacro, minimum = 0.5) {
  const perUnit = food[byMacro];
  if (!perUnit) {
    return minimum;
  }
  return Math.max(minimum, round(1 / perUnit, 1));
}

export function buildAutoMealSuggestions(template) {
  const carbFoods = pickFoods("主食", (a, b) => (b.carbs / b.calories) - (a.carbs / a.calories));
  const proteinFoods = pickFoods("蛋白", (a, b) => (b.protein / b.calories) - (a.protein / a.calories));
  const fatFoods = pickFoods("脂肪", (a, b) => (b.fat / b.calories) - (a.fat / a.calories));
  const vegFoods = pickFoods("蔬菜", (a, b) => a.calories - b.calories);

  return Object.fromEntries(
    mealSlots.map((slot) => {
      const target = {
        carbs: template.carbs * slot.ratio,
        protein: template.protein * slot.ratio,
        fat: template.fat * slot.ratio,
      };

      if (slot.id === "training") {
        const banana = foodLibrary.find((food) => food.id === "banana");
        const whey = foodLibrary.find((food) => food.id === "whey-protein");
        return [
          slot.id,
          [
            { foodId: banana.id, servings: Math.max(0.8, round(target.carbs / banana.carbs, 1)) },
            { foodId: whey.id, servings: Math.max(1, round(target.protein / whey.protein, 1)) },
          ],
        ];
      }

      const carbFood = carbFoods[slot.id === "dinner" ? 1 : 0] ?? carbFoods[0];
      const proteinFood = proteinFoods[slot.id === "breakfast" ? 1 : 0] ?? proteinFoods[0];
      const fatFood = fatFoods[slot.id === "dinner" ? 0 : 1] ?? fatFoods[0];
      const vegFood = vegFoods[0];

      const picks = [
        {
          foodId: carbFood.id,
          servings: Math.max(buildServing(carbFood, "carbs"), round(target.carbs / carbFood.carbs, 1)),
        },
        {
          foodId: proteinFood.id,
          servings: Math.max(buildServing(proteinFood, "protein"), round(target.protein / proteinFood.protein, 1)),
        },
        {
          foodId: fatFood.id,
          servings: Math.max(0.3, round(target.fat / fatFood.fat, 1)),
        },
        {
          foodId: vegFood.id,
          servings: 1,
        },
      ];

      return [slot.id, picks];
    }),
  );
}

function buildScheduleRows(schedule, templates, dailyExpenditure) {
  return schedule.map((type, index) => {
    const template = templates[type];
    const calories = calculateCalories(template);
    return `
      <tr>
        <td>${weekdayLabels[index]}</td>
        <td>${dayTypes[type].label}</td>
        <td>${formatNumber(template.carbs)} g</td>
        <td>${formatNumber(template.protein)} g</td>
        <td>${formatNumber(template.fat)} g</td>
        <td>${formatCalories(calories)}</td>
        <td>${formatCalories(dailyExpenditure - calories)}</td>
      </tr>
    `;
  }).join("");
}

function buildMealRows(mealPlan) {
  return mealPlan
    .map(
      (slot) => `
        <section class="meal-section">
          <h3>${slot.label}</h3>
          <p class="meta">目标：${formatNumber(slot.target.carbs)}C / ${formatNumber(slot.target.protein)}P / ${formatNumber(slot.target.fat)}F</p>
          <table>
            <thead>
              <tr>
                <th>食物</th>
                <th>份数</th>
                <th>碳水</th>
                <th>蛋白质</th>
                <th>脂肪</th>
                <th>热量</th>
              </tr>
            </thead>
            <tbody>
              ${
                slot.foods.length
                  ? slot.foods
                      .map(
                        (food) => `
                          <tr>
                            <td>${food.name}</td>
                            <td>${food.servings}</td>
                            <td>${formatNumber(food.carbs * food.servings)} g</td>
                            <td>${formatNumber(food.protein * food.servings)} g</td>
                            <td>${formatNumber(food.fat * food.servings)} g</td>
                            <td>${formatCalories(food.calories * food.servings)}</td>
                          </tr>
                        `,
                      )
                      .join("")
                  : `<tr><td colspan="6">当前餐次没有食物</td></tr>`
              }
            </tbody>
          </table>
        </section>
      `,
    )
    .join("");
}

export function exportPlan({ inputs, schedule, strategy, mealPlan, planName }) {
  const popup = window.open("", "_blank", "width=960,height=1200");
  if (!popup) {
    return;
  }

  const printable = `
    <!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="UTF-8" />
        <title>${planName || "碳循环周计划"} PDF 导出</title>
        <style>
          body { font-family: "Microsoft YaHei", "PingFang SC", sans-serif; margin: 32px; color: #111; }
          h1 { font-size: 30px; margin: 0 0 8px; }
          h2 { font-size: 20px; margin: 28px 0 12px; }
          h3 { font-size: 16px; margin: 20px 0 8px; }
          p { margin: 0 0 8px; line-height: 1.6; }
          .meta { color: #555; font-size: 13px; }
          .summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 18px; }
          .card { border: 1px solid #ddd; padding: 14px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
          th { background: #f5f5f5; }
          .meal-section { page-break-inside: avoid; }
          @media print {
            body { margin: 18mm; }
          }
        </style>
      </head>
      <body>
        <h1>${planName || "碳循环周计划"}</h1>
        <p class="meta">导出时间：${new Date().toLocaleString("zh-CN")}</p>
        <h2>基础信息</h2>
        <div class="summary-grid">
          <div class="card">身高：${inputs.height || "-"} cm</div>
          <div class="card">体重：${inputs.weight || "-"} kg</div>
          <div class="card">年龄：${inputs.age || "-"}</div>
          <div class="card">性别：${inputs.sex === "female" ? "女" : "男"}</div>
          <div class="card">每天训练时长：${inputs.trainingMinutes || "-"} 分钟</div>
          <div class="card">运动强度：${intensityOptions.find((item) => item.factor === inputs.trainingFactor)?.label || "-"}</div>
        </div>

        <h2>核心结果</h2>
        <div class="summary-grid">
          <div class="card">基础代谢：${formatCalories(strategy.bmr)}</div>
          <div class="card">训练消耗：${formatCalories(strategy.trainingBurn)}</div>
          <div class="card">每日消耗：${formatCalories(strategy.dailyExpenditure)}</div>
          <div class="card">当前模板：${dayTypes[schedule[0]].label} / 中高低节奏另见下表</div>
        </div>

        <h2>周节奏</h2>
        <table>
          <thead>
            <tr>
              <th>日期</th>
              <th>安排</th>
              <th>碳水</th>
              <th>蛋白质</th>
              <th>脂肪</th>
              <th>摄入热量</th>
              <th>热量差</th>
            </tr>
          </thead>
          <tbody>
            ${buildScheduleRows(schedule, strategy.templates, strategy.dailyExpenditure)}
          </tbody>
        </table>

        <h2>餐次分配</h2>
        ${buildMealRows(mealPlan)}
      </body>
    </html>
  `;

  popup.document.open();
  popup.document.write(printable);
  popup.document.close();
  popup.focus();
  window.setTimeout(() => popup.print(), 500);
}
