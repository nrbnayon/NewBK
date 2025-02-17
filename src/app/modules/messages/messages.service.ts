// src\app\modules\messages\messages.service.ts
import httpStatus from 'http-status';
import ApiError from '../../../errors/ApiError';
import { Chat } from '../chat/chat.model';
import { Types } from 'mongoose';
import { Message } from './messages.model';
import { IMessage, IMessageFilters } from './messages.interface';

const getAllMessages = async (chatId: string): Promise<IMessage[]> => {
  const messages = await Message.find({
    chat: chatId,
    isDeleted: false,
  })
    .populate('sender', 'name email image')
    .populate('replyTo')
    .populate('chat')
    .sort({ createdAt: 1 });

  return messages.map(msg => msg.toObject());
};

const sendMessage = async (
  userId: string,
  content: string,
  chatId: string,
  replyToId?: string
): Promise<IMessage> => {
  if (!content || !chatId) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Invalid data passed into request'
    );
  }

  const newMessage = {
    sender: userId,
    content,
    chat: chatId,
    replyTo: replyToId ? new Types.ObjectId(replyToId) : undefined,
    readBy: [userId],
  };

  let message = await Message.create(newMessage);

  if (!message) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to create message'
    );
  }

  message = await message.populate([
    { path: 'sender', select: 'name image' },
    { path: 'chat' },
    { path: 'replyTo' },
  ]);

  await Chat.findByIdAndUpdate(chatId, { latestMessage: message });

  return message.toObject();
};

const editMessage = async (
  messageId: string,
  userId: string,
  newContent: string
): Promise<IMessage> => {
  const message = await Message.findById(messageId);

  if (!message) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Message not found');
  }

  if (message.sender.toString() !== userId) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Can only edit your own messages');
  }

  if (message.isDeleted) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot edit deleted message');
  }

  const editHistoryEntry = {
    content: message.content,
    editedAt: new Date(),
  };

  const updatedMessage = await Message.findByIdAndUpdate(
    messageId,
    {
      content: newContent,
      isEdited: true,
      $push: { editHistory: editHistoryEntry },
    },
    { new: true }
  )
    .populate('sender', 'name image')
    .populate('replyTo');

  if (!updatedMessage) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Message not found after update');
  }

  return updatedMessage.toObject();
};

const deleteMessage = async (
  messageId: string,
  userId: string
): Promise<IMessage> => {
  const message = await Message.findById(messageId);

  if (!message) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Message not found');
  }

  if (message.sender.toString() !== userId) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'Can only delete your own messages'
    );
  }

  const updatedMessage = await Message.findByIdAndUpdate(
    messageId,
    {
      isDeleted: true,
      deletedAt: new Date(),
      content: 'This message has been deleted',
    },
    { new: true }
  );

  if (!updatedMessage) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Message not found after update');
  }

  return updatedMessage.toObject();
};

const markMessageAsRead = async (
  messageId: string,
  userId: string
): Promise<IMessage> => {
  const message = await Message.findByIdAndUpdate(
    messageId,
    {
      $addToSet: { readBy: userId },
    },
    { new: true }
  ).populate('readBy', 'name image');

  if (!message) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Message not found');
  }

  return message.toObject();
};

const togglePinMessage = async (
  messageId: string,
  userId: string
): Promise<IMessage> => {
  const message = await Message.findById(messageId);

  if (!message) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Message not found');
  }

  const updatedMessage = await Message.findByIdAndUpdate(
    messageId,
    {
      isPinned: !message.isPinned,
    },
    { new: true }
  ).populate('sender', 'name image');

  if (!updatedMessage) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Message not found after update');
  }

  return updatedMessage.toObject();
};

const searchMessages = async (
  filters: IMessageFilters
): Promise<IMessage[]> => {
  const { searchTerm, chatId, isPinned, startDate, endDate } = filters;

  const query: any = { isDeleted: false };

  if (searchTerm) {
    query.$text = { $search: searchTerm };
  }

  if (chatId) {
    query.chat = chatId;
  }

  if (isPinned !== undefined) {
    query.isPinned = isPinned;
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = startDate;
    if (endDate) query.createdAt.$lte = endDate;
  }

  const messages = await Message.find(query)
    .populate('sender', 'name email image')
    .populate('replyTo')
    .populate('chat')
    .sort({ createdAt: -1 });

  return messages.map(msg => msg.toObject());
};

const getUnseenMessageCount = async (
  chatId: string,
  userId: string
): Promise<number> => {
  const count = await Message.countDocuments({
    chat: chatId,
    readBy: { $ne: userId },
    sender: { $ne: userId },
    isDeleted: false,
  });

  return count;
};

export const MessageService = {
  getAllMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  markMessageAsRead,
  togglePinMessage,
  searchMessages,
  getUnseenMessageCount,
};
