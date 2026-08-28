export type HomeFeedComposeSettings = {
  caption: string;
  locationLabel: string;
  taggedUserIds: string[];
  allowComments: boolean;
  allowLikes: boolean;
  allowReplies: boolean;
};

export const defaultPostComposeSettings = (): HomeFeedComposeSettings => ({
  caption: '',
  locationLabel: '',
  taggedUserIds: [],
  allowComments: true,
  allowLikes: true,
  allowReplies: true,
});
