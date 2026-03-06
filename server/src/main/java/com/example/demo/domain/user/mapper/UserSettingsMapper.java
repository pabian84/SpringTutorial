package com.example.demo.domain.user.mapper;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import com.example.demo.domain.user.dto.UserSettingsDTO;

@Mapper
public interface UserSettingsMapper {

    @Select("SELECT user_id as userId, google_calendar_id as googleCalendarId, google_api_key as googleApiKey, default_ai_engine as defaultAiEngine FROM user_settings WHERE user_id = #{userId}")
    UserSettingsDTO findSettingsByUserId(String userId);

    @Insert("INSERT INTO user_settings (user_id, google_calendar_id, google_api_key, default_ai_engine) " +
            "VALUES (#{userId}, #{googleCalendarId}, #{googleApiKey}, #{defaultAiEngine})")
    void insertSettings(UserSettingsDTO settings);

    @Update("UPDATE user_settings SET " +
            "google_calendar_id = #{googleCalendarId}, " +
            "google_api_key = #{googleApiKey}, " +
            "default_ai_engine = #{defaultAiEngine} " +
            "WHERE user_id = #{userId}")
    void updateSettings(UserSettingsDTO settings);
}
