import { fetcher } from "../fetcher"

// Mock global fetch
global.fetch = jest.fn()

describe("Fetcher Component Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // REDOVNI SLUČAJ 2: Uspješan API poziv
  it("trebao bi uspješno dohvatiti podatke iz API-ja", async () => {
    const mockData = { id: 1, name: "Test User" }
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockData,
    })

    const result = await fetcher("http://localhost:8000/api/users/1")
    expect(result).toEqual(mockData)
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  // IZAZIVANJE IZNIMKE 1: Testiranje greške pri neuspješnom API pozivu
  it("trebao bi baciti grešku kada API vrati status koji nije ok", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
    })

    await expect(
      fetcher("http://localhost:8000/api/users/999")
    ).rejects.toThrow("Fetch failed: 404 Not Found")
  })

  // IZAZIVANJE IZNIMKE 2: Testiranje mrežne greške
  it("trebao bi pravilno rukovati mrežnim greškama", async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error("Network error")
    )

    await expect(fetcher("http://localhost:8000/api/test")).rejects.toThrow(
      "Fetcher error: Network error"
    )
  })
})
