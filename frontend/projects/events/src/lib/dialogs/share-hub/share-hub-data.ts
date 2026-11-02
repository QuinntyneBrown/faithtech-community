export interface ShareHubData {
  eventTitle: string;
  /** The hub page's address on the organisation's host (EventHubDto.link, L2-165). */
  link: string;
  status: 'Draft' | 'Published';
}

/** The draft note (L2-193 AC4), shared with the full-screen view (L2-194 AC5). */
export const HUB_DRAFT_NOTE = {
  heading: 'Your hub is a draft',
  text: 'Until you publish it, the code opens the hub only for people who manage event hubs. Everyone else sees “This hub isn’t available”.',
};
