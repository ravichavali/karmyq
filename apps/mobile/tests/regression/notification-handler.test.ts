/**
 * Guards the notification presentation contract across Expo SDK upgrades.
 *
 * SDK 57 made `shouldShowBanner` / `shouldShowList` required on
 * `NotificationBehavior` and deprecated the single `shouldShowAlert` flag that
 * previously covered both. `tsc` catches a *missing* field; it cannot catch an
 * upgrade quietly changing how notifications are presented — so assert the
 * exact resolved behaviour here.
 */

const mockSetNotificationHandler = jest.fn();

jest.mock("expo-notifications", () => ({
  setNotificationHandler: mockSetNotificationHandler,
}));
// Both are imported at the module's top level, so they must be stubbed to keep
// real native/React Native source out of the `node` test environment.
jest.mock("expo-device", () => ({ isDevice: true }));
jest.mock("react-native", () => ({ Platform: { OS: "ios" } }));

// Importing the module runs its top-level setNotificationHandler call. This must be
// `require`, not `import`: babel hoists ESM imports above `mockSetNotificationHandler`,
// so jest's lazy factory would read it from the temporal dead zone.
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("../../services/notifications");

describe("notification presentation behaviour", () => {
  it("registers exactly one notification handler at module load", () => {
    expect(mockSetNotificationHandler).toHaveBeenCalledTimes(1);
  });

  // `toEqual` is exhaustive over defined properties, so this also fails if the
  // deprecated `shouldShowAlert` flag ever comes back.
  it("presents notifications as a banner, a tray entry, a sound and a badge", async () => {
    const [{ handleNotification }] = mockSetNotificationHandler.mock.calls[0];

    await expect(handleNotification()).resolves.toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    });
  });
});
