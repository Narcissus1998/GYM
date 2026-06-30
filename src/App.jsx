import { useEffect, useMemo, useState } from "react";
import { foodLibrary } from "./data/foods";
import {
  bodyTypes,
  buildMealPlan,
  calculateCalories,
  calculateMacroDiff,
  calculateScheduledTotals,
  calculateStrategy,
  countSchedule,
  dayTypes,
  defaultSchedule,
  exportPlan,
  formatCalories,
  formatNumber,
  mealSlots,
  weekdayLabels,
} from "./lib/planner";

const STORAGE_KEY = "carb-cycle-planner-state-v1";

const initialInputs = {
  height: 165,
  weight: 65,
  age: 28,
  sex: "male",
  trainingMinutes: 80,
  trainingFactor: 8,
  bodyType: "meso",
  planName: "中胚训练周",
};

const initialFoodsBySlot = {
  breakfast: [{ foodId: "oats", servings: 0.8 }, { foodId: "egg", servings: 2 }],
  lunch: [{ foodId: "rice", servings: 2 }, { foodId: "chicken-breast", servings: 1.5 }, { foodId: "broccoli", servings: 1 }],
  training: [{ foodId: "banana", servings: 1.5 }, { foodId: "salmon", servings: 1 }],
  dinner: [{ foodId: "sweet-potato", servings: 2 }, { foodId: "beef", servings: 1.2 }, { foodId: "avocado", servings: 0.8 }],
};

function mapFoodsForSlot(foodsBySlot) {
  return Object.fromEntries(
    Object.entries(foodsBySlot).map(([slotId, foods]) => [
      slotId,
      foods.map((item) => {
        const food = foodLibrary.find((entry) => entry.id === item.foodId);
        return {
          ...food,
          servings: item.servings,
        };
      }),
    ]),
  );
}

export default function App() {
  const [inputs, setInputs] = useState(initialInputs);
  const [schedule, setSchedule] = useState(defaultSchedule);
  const [selectedDayType, setSelectedDayType] = useState("medium");
  const [foodsBySlot, setFoodsBySlot] = useState(initialFoodsBySlot);
  const [saveNotice, setSaveNotice] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return;
    }

    try {
      const parsed = JSON.parse(saved);
      if (parsed.inputs) {
        setInputs(parsed.inputs);
      }
      if (Array.isArray(parsed.schedule)) {
        setSchedule(parsed.schedule);
      }
      if (parsed.foodsBySlot) {
        setFoodsBySlot(parsed.foodsBySlot);
      }
      if (parsed.selectedDayType) {
        setSelectedDayType(parsed.selectedDayType);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const activeStrategy = useMemo(() => calculateStrategy(inputs, "active"), [inputs]);
  const referenceStrategy = useMemo(() => calculateStrategy(inputs, "reference"), [inputs]);

  const scheduleCounts = useMemo(() => countSchedule(schedule), [schedule]);
  const scheduledTotals = useMemo(
    () => calculateScheduledTotals(schedule, activeStrategy.templates),
    [schedule, activeStrategy.templates],
  );

  const selectedTemplate = activeStrategy.templates[selectedDayType];
  const mealPlan = useMemo(
    () => buildMealPlan(selectedTemplate, mapFoodsForSlot(foodsBySlot)),
    [selectedTemplate, foodsBySlot],
  );

  const actualMealTotals = useMemo(
    () =>
      mealPlan.reduce(
        (acc, slot) => {
          acc.carbs += slot.actual.carbs;
          acc.protein += slot.actual.protein;
          acc.fat += slot.actual.fat;
          acc.calories += slot.actual.calories;
          return acc;
        },
        { carbs: 0, protein: 0, fat: 0, calories: 0 },
      ),
    [mealPlan],
  );

  const mealDiff = useMemo(() => calculateMacroDiff(selectedTemplate, actualMealTotals), [selectedTemplate, actualMealTotals]);

  function updateInput(key, value) {
    setInputs((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateSchedule(index, value) {
    setSchedule((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)));
  }

  function updateFood(slotId, index, field, value) {
    setFoodsBySlot((current) => ({
      ...current,
      [slotId]: current[slotId].map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]: field === "servings" ? Number(value) : value,
            }
          : item,
      ),
    }));
  }

  function addFood(slotId) {
    setFoodsBySlot((current) => ({
      ...current,
      [slotId]: [...current[slotId], { foodId: foodLibrary[0].id, servings: 1 }],
    }));
  }

  function removeFood(slotId, index) {
    setFoodsBySlot((current) => ({
      ...current,
      [slotId]: current[slotId].filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function savePlan() {
    const payload = {
      inputs,
      schedule,
      foodsBySlot,
      selectedDayType,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setSaveNotice("计划已保存到本地浏览器。");
    window.setTimeout(() => setSaveNotice(""), 2200);
  }

  function handleExport() {
    exportPlan({
      inputs,
      schedule,
      strategy: activeStrategy,
      mealPlan,
      planName: inputs.planName,
    });
  }

  const scheduleBalanced = scheduleCounts.high === 2 && scheduleCounts.medium === 3 && scheduleCounts.low === 2;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-mark">ATHLETE FUEL SYSTEM</div>
        <div className="topbar-actions">
          <button className="secondary-pill" type="button" onClick={savePlan}>
            保存计划
          </button>
          <button className="primary-pill" type="button" onClick={handleExport}>
            导出周计划
          </button>
        </div>
      </header>

      <main className="page">
        <section className="hero-block">
          <div className="hero-copy">
            <p className="hero-kicker">CARB CYCLE / PERFORMANCE NUTRITION</p>
            <h1>碳循环训练饮食工具</h1>
            <p className="hero-lede">
              为训练者建立一套可以落地执行的周饮食系统：先生成日模板，再分配一周节奏，再把目标拆成可吃的食物和餐次。
            </p>
            <div className="hero-cta-row">
              <button className="primary-pill" type="button" onClick={() => document.getElementById("planner")?.scrollIntoView({ behavior: "smooth" })}>
                开始配置
              </button>
              <button className="secondary-pill" type="button" onClick={() => document.getElementById("meals")?.scrollIntoView({ behavior: "smooth" })}>
                查看餐次分配
              </button>
            </div>
          </div>
          <div className="hero-billboard" aria-hidden="true">
            <div className="billboard-pane pane-black">TRAIN</div>
            <div className="billboard-pane pane-white">FUEL</div>
          </div>
        </section>

        <section className="headline-row" id="planner">
          <div>
            <p className="section-kicker">Plan Setup</p>
            <h2>计划参数</h2>
          </div>
          <div className="headline-meta">
            <span>{bodyTypes[inputs.bodyType].label}体质</span>
            <span>{scheduleBalanced ? "2-3-2 节奏已对齐" : "当前排期偏离 2-3-2 节奏"}</span>
          </div>
        </section>

        <section className="planner-grid">
          <article className="panel panel-form">
            <div className="field-grid">
              <label className="field">
                <span>计划名</span>
                <input value={inputs.planName} onChange={(event) => updateInput("planName", event.target.value)} />
              </label>
              <label className="field">
                <span>身高 cm</span>
                <input type="number" value={inputs.height} onChange={(event) => updateInput("height", Number(event.target.value))} />
              </label>
              <label className="field">
                <span>体重 kg</span>
                <input type="number" value={inputs.weight} onChange={(event) => updateInput("weight", Number(event.target.value))} />
              </label>
              <label className="field">
                <span>年龄</span>
                <input type="number" value={inputs.age} onChange={(event) => updateInput("age", Number(event.target.value))} />
              </label>
              <label className="field">
                <span>性别</span>
                <select value={inputs.sex} onChange={(event) => updateInput("sex", event.target.value)}>
                  <option value="male">男</option>
                  <option value="female">女</option>
                </select>
              </label>
              <label className="field">
                <span>训练时间 分钟</span>
                <input
                  type="number"
                  value={inputs.trainingMinutes}
                  onChange={(event) => updateInput("trainingMinutes", Number(event.target.value))}
                />
              </label>
              <label className="field">
                <span>训练系数</span>
                <input
                  type="number"
                  step="0.1"
                  value={inputs.trainingFactor}
                  onChange={(event) => updateInput("trainingFactor", Number(event.target.value))}
                />
              </label>
              <label className="field field-full">
                <span>体质类型</span>
                <select value={inputs.bodyType} onChange={(event) => updateInput("bodyType", event.target.value)}>
                  <option value="endo">内胚</option>
                  <option value="meso">中胚</option>
                  <option value="ecto">外胚</option>
                </select>
              </label>
            </div>

            {saveNotice ? <p className="notice">{saveNotice}</p> : null}
          </article>

          <article className="panel panel-metrics">
            <div className="metric-stack">
              <div className="metric">
                <span>基础代谢</span>
                <strong>{formatCalories(activeStrategy.bmr)}</strong>
              </div>
              <div className="metric">
                <span>训练消耗</span>
                <strong>{formatCalories(activeStrategy.trainingBurn)}</strong>
              </div>
              <div className="metric">
                <span>每日消耗</span>
                <strong>{formatCalories(activeStrategy.dailyExpenditure)}</strong>
              </div>
            </div>

            <div className="conflict-card">
              <div className="conflict-head">
                <h3>规则差异</h3>
                <span>当前结果与参考表并排展示</span>
              </div>
              <div className="comparison-pair">
                <ComparisonBlock
                  title="当前规则"
                  coefficients={activeStrategy.coefficients}
                  targets={activeStrategy.dailyTargets}
                />
                <ComparisonBlock
                  title="参考表"
                  coefficients={referenceStrategy.coefficients}
                  targets={referenceStrategy.dailyTargets}
                />
              </div>
            </div>
          </article>
        </section>

        <section className="headline-row">
          <div>
            <p className="section-kicker">Weekly Rotation</p>
            <h2>周碳循环节奏</h2>
          </div>
          <div className="headline-meta">
            <span>高 {scheduleCounts.high}</span>
            <span>中 {scheduleCounts.medium}</span>
            <span>低 {scheduleCounts.low}</span>
          </div>
        </section>

        <section className="rotation-layout">
          <article className="template-band">
            {Object.entries(activeStrategy.templates).map(([key, template]) => (
              <div className="template-card" key={key}>
                <div className="template-card-head">
                  <h3>{dayTypes[key].label}</h3>
                  <button
                    type="button"
                    className={`chip-button ${selectedDayType === key ? "chip-active" : ""}`}
                    onClick={() => setSelectedDayType(key)}
                  >
                    用于餐次分配
                  </button>
                </div>
                <dl>
                  <div>
                    <dt>碳水</dt>
                    <dd>{formatNumber(template.carbs)} g</dd>
                  </div>
                  <div>
                    <dt>蛋白质</dt>
                    <dd>{formatNumber(template.protein)} g</dd>
                  </div>
                  <div>
                    <dt>脂肪</dt>
                    <dd>{formatNumber(template.fat)} g</dd>
                  </div>
                  <div>
                    <dt>摄入热量</dt>
                    <dd>{formatCalories(calculateCalories(template))}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </article>

          <article className="schedule-panel">
            <div className="schedule-grid">
              {weekdayLabels.map((day, index) => (
                <label className="schedule-field" key={day}>
                  <span>{day}</span>
                  <select value={schedule[index]} onChange={(event) => updateSchedule(index, event.target.value)}>
                    <option value="medium">中碳</option>
                    <option value="high">高碳</option>
                    <option value="low">低碳</option>
                  </select>
                </label>
              ))}
            </div>

            <div className={`schedule-status ${scheduleBalanced ? "status-ok" : "status-warn"}`}>
              {scheduleBalanced
                ? "当前排期与 2-3-2 节奏一致，一周总量能完整回到目标。"
                : "当前排期偏离 2-3-2 节奏，一周总量会出现偏差。"}
            </div>

            <ScheduleTable
              schedule={schedule}
              templates={activeStrategy.templates}
              weeklyTargets={activeStrategy.weeklyTargets}
              dailyExpenditure={activeStrategy.dailyExpenditure}
            />
          </article>
        </section>

        <section className="headline-row" id="meals">
          <div>
            <p className="section-kicker">Food Conversion</p>
            <h2>食物换算与餐次分配</h2>
          </div>
          <div className="headline-meta">
            <span>{dayTypes[selectedDayType].label}模板</span>
            <span>{formatCalories(calculateCalories(selectedTemplate))}</span>
          </div>
        </section>

        <section className="meal-layout">
          <article className="meal-summary-panel">
            <div className="meal-summary-top">
              <h3>当日模板总目标</h3>
              <p>把模板拆给早餐、午餐、训练前后和晚餐，再用食物库去逼近目标。</p>
            </div>
            <div className="meal-total-grid">
              <SummaryMetric label="目标碳水" value={`${formatNumber(selectedTemplate.carbs)} g`} />
              <SummaryMetric label="目标蛋白质" value={`${formatNumber(selectedTemplate.protein)} g`} />
              <SummaryMetric label="目标脂肪" value={`${formatNumber(selectedTemplate.fat)} g`} />
              <SummaryMetric label="目标热量" value={formatCalories(calculateCalories(selectedTemplate))} />
              <SummaryMetric label="实际碳水" value={`${formatNumber(actualMealTotals.carbs)} g`} />
              <SummaryMetric label="实际蛋白质" value={`${formatNumber(actualMealTotals.protein)} g`} />
              <SummaryMetric label="实际脂肪" value={`${formatNumber(actualMealTotals.fat)} g`} />
              <SummaryMetric label="实际热量" value={formatCalories(actualMealTotals.calories)} />
            </div>
            <div className="macro-diff-bar">
              <span>碳水差值 {formatNumber(mealDiff.carbs)} g</span>
              <span>蛋白差值 {formatNumber(mealDiff.protein)} g</span>
              <span>脂肪差值 {formatNumber(mealDiff.fat)} g</span>
            </div>
          </article>

          <article className="meal-cards">
            {mealPlan.map((slot) => (
              <div className="meal-card" key={slot.id}>
                <div className="meal-card-head">
                  <div>
                    <p>{slot.label}</p>
                    <h3>{Math.round(slot.ratio * 100)}% 配额</h3>
                  </div>
                  <button className="secondary-pill secondary-small" type="button" onClick={() => addFood(slot.id)}>
                    添加食物
                  </button>
                </div>

                <div className="meal-targets">
                  <span>目标 {formatNumber(slot.target.carbs)}C / {formatNumber(slot.target.protein)}P / {formatNumber(slot.target.fat)}F</span>
                  <span>实际 {formatNumber(slot.actual.carbs)}C / {formatNumber(slot.actual.protein)}P / {formatNumber(slot.actual.fat)}F</span>
                </div>

                <div className="food-list">
                  {foodsBySlot[slot.id].map((foodItem, index) => (
                    <div className="food-row" key={`${slot.id}-${index}`}>
                      <select
                        value={foodItem.foodId}
                        onChange={(event) => updateFood(slot.id, index, "foodId", event.target.value)}
                      >
                        {foodLibrary.map((food) => (
                          <option key={food.id} value={food.id}>
                            {food.name} / {food.unit}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={foodItem.servings}
                        onChange={(event) => updateFood(slot.id, index, "servings", event.target.value)}
                      />
                      <button className="icon-button" type="button" onClick={() => removeFood(slot.id, index)}>
                        删除
                      </button>
                    </div>
                  ))}
                </div>

                <MealSlotBreakdown slot={slot} />
              </div>
            ))}
          </article>
        </section>
      </main>
    </div>
  );
}

function ComparisonBlock({ title, coefficients, targets }) {
  return (
    <div className="comparison-block">
      <h4>{title}</h4>
      <ul>
        <li>碳水 / kg <strong>{formatNumber(coefficients.carbs)} g</strong></li>
        <li>蛋白质 / kg <strong>{formatNumber(coefficients.protein)} g</strong></li>
        <li>脂肪 / kg <strong>{formatNumber(coefficients.fat)} g</strong></li>
        <li>日热量 <strong>{formatCalories(calculateCalories(targets))}</strong></li>
      </ul>
    </div>
  );
}

function ScheduleTable({ schedule, templates, weeklyTargets, dailyExpenditure }) {
  const rows = schedule.map((type, index) => {
    const template = templates[type];
    const calories = calculateCalories(template);
    return {
      day: weekdayLabels[index],
      type: dayTypes[type].label,
      ...template,
      calories,
      deficit: dailyExpenditure - calories,
    };
  });

  const scheduledTotals = calculateScheduledTotals(schedule, templates);

  return (
    <div className="schedule-table-wrap">
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
          {rows.map((row) => (
            <tr key={row.day}>
              <td>{row.day}</td>
              <td>{row.type}</td>
              <td>{formatNumber(row.carbs)} g</td>
              <td>{formatNumber(row.protein)} g</td>
              <td>{formatNumber(row.fat)} g</td>
              <td>{formatCalories(row.calories)}</td>
              <td>{formatCalories(row.deficit)}</td>
            </tr>
          ))}
          <tr className="summary-row">
            <td>周合计</td>
            <td>排期结果</td>
            <td>{formatNumber(scheduledTotals.carbs)} g</td>
            <td>{formatNumber(scheduledTotals.protein)} g</td>
            <td>{formatNumber(scheduledTotals.fat)} g</td>
            <td>{formatCalories(scheduledTotals.calories)}</td>
            <td>—</td>
          </tr>
          <tr className="summary-row">
            <td>周目标</td>
            <td>基准预算</td>
            <td>{formatNumber(weeklyTargets.carbs)} g</td>
            <td>{formatNumber(weeklyTargets.protein)} g</td>
            <td>{formatNumber(weeklyTargets.fat)} g</td>
            <td>{formatCalories(calculateCalories(weeklyTargets))}</td>
            <td>—</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function SummaryMetric({ label, value }) {
  return (
    <div className="summary-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MealSlotBreakdown({ slot }) {
  return (
    <div className="meal-breakdown">
      {slot.foods.map((food) => (
        <div className="meal-breakdown-row" key={`${slot.id}-${food.id}`}>
          <span>{food.name} × {food.servings}</span>
          <span>
            {formatNumber(food.carbs * food.servings)}C / {formatNumber(food.protein * food.servings)}P / {formatNumber(food.fat * food.servings)}F
          </span>
        </div>
      ))}
    </div>
  );
}
