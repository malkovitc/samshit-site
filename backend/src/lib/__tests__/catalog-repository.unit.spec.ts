import { planInventoryLevels } from "../catalog-repository"

describe("catalog inventory updates", () => {
  test("creates missing levels and updates existing levels at the workshop", () => {
    const plan = planInventoryLevels(
      [
        { title: "S", inventory_item_id: "item_s" },
        { title: "M", inventory_item_id: "item_m" },
        { title: "MTM", inventory_item_id: null },
      ],
      [{ inventory_item_id: "item_m", location_id: "loc_1", stocked_quantity: 3 }],
      { S: 0, M: 2, L: 0, XL: 0 },
      "loc_1",
    )
    expect(plan.create).toEqual([{ inventory_item_id: "item_s", location_id: "loc_1", stocked_quantity: 0 }])
    expect(plan.update).toEqual([{ inventory_item_id: "item_m", location_id: "loc_1", stocked_quantity: 2 }])
  })

  test("does not send an update when the stocked quantity is unchanged", () => {
    const plan = planInventoryLevels(
      [{ title: "S", inventory_item_id: "item_s" }],
      [{ inventory_item_id: "item_s", location_id: "loc_1", stocked_quantity: 1 }],
      { S: 1, M: 0, L: 0, XL: 0 }, "loc_1",
    )
    expect(plan).toEqual({ create: [], update: [] })
  })

  test("reports a missing inventory item for a managed size", () => {
    expect(() => planInventoryLevels(
      [{ title: "S", inventory_item_id: null }], [],
      { S: 1, M: 0, L: 0, XL: 0 }, "loc_1",
    )).toThrow("S")
  })
})
