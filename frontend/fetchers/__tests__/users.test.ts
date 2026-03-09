import { getHelpCategories, searchCaretakers } from "../users"

jest.mock("../fetcher", () => ({
  fetcher: jest.fn(),
}))

const { fetcher } = require("../fetcher")

describe("Users Fetcher Component Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // REDOVNI SLUČAJ 1: Uspješno dohvaćanje kategorija pomoći
  it("trebao bi uspješno dohvatiti kategorije pomoći", async () => {
    const mockKategorije = [
      { id: 1, name: "Anksioznost", subcategories: [] },
      { id: 2, name: "Kontrola emocija", subcategories: [] },
    ]

    ;(fetcher as jest.Mock).mockResolvedValueOnce(mockKategorije)

    const rezultat = await getHelpCategories()
    expect(rezultat).toEqual(mockKategorije)
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("/help-categories/"),
      { credentials: "include" }
    )
  })

  // RUBNI UVJET 1: Pretraživanje sa praznim query parametrima
  it("trebao bi rukovati pretraživanjem sa praznim upitom", async () => {
    const mockOdgovor = {
      results: [],
      count: 0,
      next: null,
      previous: null,
    }

    ;(fetcher as jest.Mock).mockResolvedValueOnce(mockOdgovor)

    const rezultat = await searchCaretakers("", [], 1)
    expect(rezultat.results).toEqual([])
    expect(rezultat.count).toBe(0)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  // NEPOSTOJEĆA FUNKCIONALNOST 1: Pozivanje nepostojeće funkcije
  it("trebao bi baciti grešku pri pozivu nepostojeće funkcije", () => {
    const usersModule = require("../users")

    expect(() => {
      usersModule.getNonExistentCaretakerData()
    }).toThrow()
  })
})
